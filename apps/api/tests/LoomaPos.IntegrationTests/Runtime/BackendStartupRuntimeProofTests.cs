using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;

namespace LoomaPos.IntegrationTests.Runtime;

public sealed class BackendStartupRuntimeProofTests : IAsyncLifetime
{
    private readonly List<TestcontainersContainer> _containers = [];
    private readonly List<BackendProcessHandle> _backendProcesses = [];

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        foreach (var backendProcess in _backendProcesses)
        {
            await backendProcess.DisposeAsync();
        }

        foreach (var container in _containers)
        {
            await container.DisposeAsync();
        }
    }

    [Fact]
    public async Task ColdStart_WithDelayedDatabase_ShouldRecoverAndBecomeReady()
    {
        var postgresContainer = CreateDelayedPostgresContainer();
        if (!await TryStartContainerAsync(postgresContainer))
        {
            return;
        }

        var postgresPort = postgresContainer.GetMappedPublicPort(5432);
        var connectionString = BuildPostgresConnectionString(postgresPort);
        var apiPort = ReserveTcpPort();

        var backend = await StartBackendProcessAsync(
            apiPort,
            connectionString,
            startupDbInitMaxAttempts: 20,
            startupDbInitDelaySeconds: 1);

        var readinessProbe = await WaitForReadinessAsync(apiPort, TimeSpan.FromSeconds(90));

        Assert.True(
            readinessProbe.IsReady,
            $"Backend did not become ready. Last observation: {readinessProbe.LastObservation}\nLogs:\n{backend.GetLogs()}");
        Assert.True(
            readinessProbe.SawUnavailableBeforeReady || readinessProbe.SawNotReadyBeforeReady,
            "Backend reported ready without passing through an unavailable/not-ready startup window.");

        var logs = backend.GetLogs();
        Assert.Contains("startup_database_initialization_retry_scheduled", logs, StringComparison.Ordinal);
        Assert.Contains("startup_database_initialization_completed", logs, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Startup_WithUnreachableDatabase_ShouldFailFast_WithoutHalfStartedRuntime()
    {
        var apiPort = ReserveTcpPort();
        const string unreachableConnectionString = "Host=127.0.0.1;Port=1;Database=loomapos;Username=loomapos;Password=loomapos;Timeout=2;Command Timeout=2";

        var backend = await StartBackendProcessAsync(
            apiPort,
            unreachableConnectionString,
            startupDbInitMaxAttempts: 3,
            startupDbInitDelaySeconds: 1);

        var exited = await backend.WaitForExitAsync(TimeSpan.FromSeconds(45));

        Assert.True(exited, "Backend process did not exit after startup initialization failure.");
        Assert.NotEqual(0, backend.ExitCode);

        var logs = backend.GetLogs();
        Assert.Contains("startup_database_initialization_failed", logs, StringComparison.Ordinal);

        var probe = await ProbeEndpointAsync(apiPort, "/health/live");
        Assert.False(probe.IsReachable, "Backend served traffic despite startup initialization failure.");
    }

    [Fact]
    public async Task RepeatedStarts_WithHealthyDatabase_ShouldRemainStable()
    {
        var postgresContainer = CreateHealthyPostgresContainer();
        if (!await TryStartContainerAsync(postgresContainer))
        {
            return;
        }

        var postgresPort = postgresContainer.GetMappedPublicPort(5432);
        var connectionString = BuildPostgresConnectionString(postgresPort);

        for (var attempt = 1; attempt <= 3; attempt++)
        {
            var apiPort = ReserveTcpPort();
            var backend = await StartBackendProcessAsync(
                apiPort,
                connectionString,
                startupDbInitMaxAttempts: 5,
                startupDbInitDelaySeconds: 1);

            var readinessProbe = await WaitForReadinessAsync(apiPort, TimeSpan.FromSeconds(60));
            Assert.True(
                readinessProbe.IsReady,
                $"Backend did not stabilize on startup cycle {attempt}. Last observation: {readinessProbe.LastObservation}\nLogs:\n{backend.GetLogs()}");

            var liveProbe = await ProbeEndpointAsync(apiPort, "/health/live");
            Assert.True(liveProbe.IsReachable, $"Live endpoint not reachable on startup cycle {attempt}.");
            Assert.Equal(HttpStatusCode.OK, liveProbe.StatusCode);

            var readyProbe = await ProbeEndpointAsync(apiPort, "/health/ready");
            Assert.True(readyProbe.IsReachable, $"Ready endpoint not reachable on startup cycle {attempt}.");
            Assert.Equal(HttpStatusCode.OK, readyProbe.StatusCode);
            Assert.Contains("\"status\":\"ready\"", readyProbe.Body, StringComparison.OrdinalIgnoreCase);

            await backend.DisposeAsync();
        }
    }

    private async Task<bool> TryStartContainerAsync(TestcontainersContainer container)
    {
        try
        {
            await container.StartAsync();
            _containers.Add(container);
            return true;
        }
        catch
        {
            await container.DisposeAsync();
            return false;
        }
    }

    private async Task<BackendProcessHandle> StartBackendProcessAsync(
        int apiPort,
        string postgresConnectionString,
        int startupDbInitMaxAttempts,
        int startupDbInitDelaySeconds)
    {
        var repoRoot = ResolveRepositoryRoot();
        var apiProjectPath = Path.Combine(repoRoot, "apps", "api", "src", "LoomaPos.Api", "LoomaPos.Api.csproj");

        var startInfo = new ProcessStartInfo("dotnet", $"run --no-launch-profile --project \"{apiProjectPath}\"")
        {
            WorkingDirectory = repoRoot,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };

        startInfo.Environment["ASPNETCORE_ENVIRONMENT"] = "Production";
        startInfo.Environment["DOTNET_ENVIRONMENT"] = "Production";
        startInfo.Environment["ASPNETCORE_URLS"] = $"http://127.0.0.1:{apiPort}";
        startInfo.Environment["ConnectionStrings__Postgres"] = postgresConnectionString;
        startInfo.Environment["ConnectionStrings__Redis"] = string.Empty;
        startInfo.Environment["Hangfire__Enabled"] = "false";
        startInfo.Environment["Ops__AllowPlaceholderSecrets"] = "true";
        startInfo.Environment["Ops__StartupDbInitMaxAttempts"] = startupDbInitMaxAttempts.ToString();
        startInfo.Environment["Ops__StartupDbInitDelaySeconds"] = startupDbInitDelaySeconds.ToString();

        var process = new Process
        {
            StartInfo = startInfo,
            EnableRaisingEvents = true
        };

        var logLines = new ConcurrentQueue<string>();
        process.OutputDataReceived += (_, eventArgs) =>
        {
            if (!string.IsNullOrWhiteSpace(eventArgs.Data))
            {
                logLines.Enqueue(eventArgs.Data);
            }
        };
        process.ErrorDataReceived += (_, eventArgs) =>
        {
            if (!string.IsNullOrWhiteSpace(eventArgs.Data))
            {
                logLines.Enqueue(eventArgs.Data);
            }
        };

        if (!process.Start())
        {
            throw new InvalidOperationException("Failed to start backend process for runtime proof.");
        }

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        var handle = new BackendProcessHandle(process, logLines);
        _backendProcesses.Add(handle);

        await Task.Delay(250);
        return handle;
    }

    private static TestcontainersContainer CreateHealthyPostgresContainer()
    {
        return new TestcontainersBuilder<TestcontainersContainer>()
            .WithImage("postgres:16-alpine")
            .WithEnvironment("POSTGRES_USER", "loomapos")
            .WithEnvironment("POSTGRES_PASSWORD", "loomapos")
            .WithEnvironment("POSTGRES_DB", "loomapos")
            .WithPortBinding(5432, true)
            .WithWaitStrategy(Wait.ForUnixContainer().UntilPortIsAvailable(5432))
            .Build();
    }

    private static TestcontainersContainer CreateDelayedPostgresContainer()
    {
        return new TestcontainersBuilder<TestcontainersContainer>()
            .WithImage("postgres:16-alpine")
            .WithEnvironment("POSTGRES_USER", "loomapos")
            .WithEnvironment("POSTGRES_PASSWORD", "loomapos")
            .WithEnvironment("POSTGRES_DB", "loomapos")
            .WithPortBinding(5432, true)
            .WithEntrypoint("/bin/sh", "-c")
            .WithCommand("sleep 6 && exec docker-entrypoint.sh postgres")
            .Build();
    }

    private static string BuildPostgresConnectionString(int port)
    {
        return $"Host=127.0.0.1;Port={port};Database=loomapos;Username=loomapos;Password=loomapos;Timeout=3;Command Timeout=3";
    }

    private static int ReserveTcpPort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }

    private static async Task<ReadinessProbeObservation> WaitForReadinessAsync(int apiPort, TimeSpan timeout)
    {
        using var httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(2)
        };

        var deadline = DateTimeOffset.UtcNow.Add(timeout);
        var sawUnavailable = false;
        var sawNotReady = false;
        var lastObservation = "no_readiness_observation";

        while (DateTimeOffset.UtcNow < deadline)
        {
            var probe = await ProbeEndpointAsync(apiPort, "/health/ready", httpClient);
            if (!probe.IsReachable)
            {
                sawUnavailable = true;
                lastObservation = probe.Body;
            }
            else
            {
                if (probe.StatusCode == HttpStatusCode.ServiceUnavailable)
                {
                    sawNotReady = true;
                }

                lastObservation = probe.StatusCode is { } statusCode
                    ? $"{(int)statusCode} {probe.Body}"
                    : probe.Body;

                if (probe.StatusCode == HttpStatusCode.OK)
                {
                    if (IsReadyPayload(probe.Body))
                    {
                        return new ReadinessProbeObservation(true, sawUnavailable, sawNotReady, lastObservation);
                    }
                }
            }

            await Task.Delay(400);
        }

        return new ReadinessProbeObservation(false, sawUnavailable, sawNotReady, lastObservation);
    }

    private static bool IsReadyPayload(string payload)
    {
        try
        {
            using var document = JsonDocument.Parse(payload);
            if (!document.RootElement.TryGetProperty("status", out var status))
            {
                return false;
            }

            return string.Equals(status.GetString(), "ready", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static async Task<EndpointProbeResult> ProbeEndpointAsync(int apiPort, string path, HttpClient? client = null)
    {
        var ownsClient = client is null;
        client ??= new HttpClient { Timeout = TimeSpan.FromSeconds(2) };

        try
        {
            using var response = await client.GetAsync($"http://127.0.0.1:{apiPort}{path}");
            var body = await response.Content.ReadAsStringAsync();
            return new EndpointProbeResult(true, response.StatusCode, body);
        }
        catch (Exception ex)
        {
            return new EndpointProbeResult(false, null, $"unreachable: {ex.Message}");
        }
        finally
        {
            if (ownsClient)
            {
                client.Dispose();
            }
        }
    }

    private static string ResolveRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "apps", "api", "src", "LoomaPos.Api", "LoomaPos.Api.csproj");
            if (File.Exists(candidate))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        throw new InvalidOperationException("Could not resolve repository root for backend runtime proof tests.");
    }

    private readonly record struct ReadinessProbeObservation(
        bool IsReady,
        bool SawUnavailableBeforeReady,
        bool SawNotReadyBeforeReady,
        string LastObservation);

    private readonly record struct EndpointProbeResult(
        bool IsReachable,
        HttpStatusCode? StatusCode,
        string Body);

    private sealed class BackendProcessHandle(Process process, ConcurrentQueue<string> logLines) : IAsyncDisposable
    {
        private readonly Process _process = process;
        private readonly ConcurrentQueue<string> _logLines = logLines;

        public int ExitCode => _process.HasExited ? _process.ExitCode : -1;

        public string GetLogs() => string.Join(Environment.NewLine, _logLines);

        public async Task<bool> WaitForExitAsync(TimeSpan timeout)
        {
            using var cancellationSource = new CancellationTokenSource(timeout);
            try
            {
                await _process.WaitForExitAsync(cancellationSource.Token);
                return true;
            }
            catch (OperationCanceledException)
            {
                return false;
            }
        }

        public async ValueTask DisposeAsync()
        {
            try
            {
                if (!_process.HasExited)
                {
                    _process.Kill(entireProcessTree: true);
                    await _process.WaitForExitAsync();
                }
            }
            catch
            {
                // Best-effort cleanup.
            }
            finally
            {
                _process.Dispose();
            }
        }
    }
}
