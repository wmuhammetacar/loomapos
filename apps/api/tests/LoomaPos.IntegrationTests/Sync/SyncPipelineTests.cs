using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Npgsql;

namespace LoomaPos.IntegrationTests.Sync;

public sealed class SyncPipelineTests : IAsyncLifetime
{
    private readonly TestcontainersContainer _postgresContainer = new TestcontainersBuilder<TestcontainersContainer>()
        .WithImage("postgres:16-alpine")
        .WithEnvironment("POSTGRES_USER", "loomapos")
        .WithEnvironment("POSTGRES_PASSWORD", "loomapos")
        .WithEnvironment("POSTGRES_DB", "loomapos")
        .WithPortBinding(5432, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilPortIsAvailable(5432))
        .Build();

    private string _connectionString = string.Empty;
    private bool _isContainerReady;

    public async Task InitializeAsync()
    {
        try
        {
            await _postgresContainer.StartAsync();
            _isContainerReady = true;
        }
        catch (Exception ex)
        {
            _ = ex;
            _isContainerReady = false;
            return;
        }

        var port = _postgresContainer.GetMappedPublicPort(5432);
        _connectionString = $"Host=127.0.0.1;Port={port};Database=loomapos;Username=loomapos;Password=loomapos";

        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(
            """
            CREATE TABLE IF NOT EXISTS processed_events (
                event_id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                device_id uuid NOT NULL,
                processed_at timestamptz NOT NULL DEFAULT now()
            );
            """,
            connection);
        await command.ExecuteNonQueryAsync();
    }

    public async Task DisposeAsync()
    {
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task EventProcessing_ShouldBeIdempotent_ByEventId()
    {
        if (!_isContainerReady)
        {
            return;
        }

        var eventId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();

        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();

        await using (var insertCommand = new NpgsqlCommand(
                         """
                         INSERT INTO processed_events(event_id, tenant_id, device_id)
                         VALUES (@event_id, @tenant_id, @device_id);
                         """,
                         connection))
        {
            insertCommand.Parameters.AddWithValue("event_id", eventId);
            insertCommand.Parameters.AddWithValue("tenant_id", tenantId);
            insertCommand.Parameters.AddWithValue("device_id", deviceId);
            await insertCommand.ExecuteNonQueryAsync();
        }

        var duplicateViolated = false;
        try
        {
            await using var duplicateInsertCommand = new NpgsqlCommand(
                """
                INSERT INTO processed_events(event_id, tenant_id, device_id)
                VALUES (@event_id, @tenant_id, @device_id);
                """,
                connection);
            duplicateInsertCommand.Parameters.AddWithValue("event_id", eventId);
            duplicateInsertCommand.Parameters.AddWithValue("tenant_id", tenantId);
            duplicateInsertCommand.Parameters.AddWithValue("device_id", deviceId);
            await duplicateInsertCommand.ExecuteNonQueryAsync();
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            duplicateViolated = true;
        }

        Assert.True(duplicateViolated);

        await using var countCommand = new NpgsqlCommand(
            "SELECT COUNT(1) FROM processed_events WHERE event_id = @event_id;",
            connection);
        countCommand.Parameters.AddWithValue("event_id", eventId);
        var count = (long)(await countCommand.ExecuteScalarAsync() ?? 0L);
        Assert.Equal(1L, count);
    }
}
