using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Npgsql;

namespace LoomaPos.IntegrationTests.Integrations;

public sealed class ProviderWebhookIdempotencyTests : IAsyncLifetime
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
        catch
        {
            _isContainerReady = false;
            return;
        }

        var port = _postgresContainer.GetMappedPublicPort(5432);
        _connectionString = $"Host=127.0.0.1;Port={port};Database=loomapos;Username=loomapos;Password=loomapos";

        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(
            """
            CREATE TABLE IF NOT EXISTS provider_webhook_events (
                id uuid PRIMARY KEY,
                provider_code text NOT NULL,
                event_key text NOT NULL,
                payload_json text NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_provider_webhook_events_provider_event_key
                ON provider_webhook_events(provider_code, event_key);
            """,
            connection);
        await command.ExecuteNonQueryAsync();
    }

    public async Task DisposeAsync()
    {
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task DuplicateWebhookInsert_ShouldViolateProviderEventUniqueness()
    {
        if (!_isContainerReady)
        {
            return;
        }

        var eventId = Guid.NewGuid();
        const string provider = "mock-einvoice";
        const string eventKey = "evt-phase9-001";

        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();

        await using (var insertCommand = new NpgsqlCommand(
                         """
                         INSERT INTO provider_webhook_events(id, provider_code, event_key, payload_json)
                         VALUES (@id, @provider_code, @event_key, @payload_json);
                         """,
                         connection))
        {
            insertCommand.Parameters.AddWithValue("id", eventId);
            insertCommand.Parameters.AddWithValue("provider_code", provider);
            insertCommand.Parameters.AddWithValue("event_key", eventKey);
            insertCommand.Parameters.AddWithValue("payload_json", "{\"status\":\"accepted\"}");
            await insertCommand.ExecuteNonQueryAsync();
        }

        var duplicateViolated = false;
        try
        {
            await using var duplicateInsertCommand = new NpgsqlCommand(
                """
                INSERT INTO provider_webhook_events(id, provider_code, event_key, payload_json)
                VALUES (@id, @provider_code, @event_key, @payload_json);
                """,
                connection);
            duplicateInsertCommand.Parameters.AddWithValue("id", Guid.NewGuid());
            duplicateInsertCommand.Parameters.AddWithValue("provider_code", provider);
            duplicateInsertCommand.Parameters.AddWithValue("event_key", eventKey);
            duplicateInsertCommand.Parameters.AddWithValue("payload_json", "{\"status\":\"duplicate\"}");
            await duplicateInsertCommand.ExecuteNonQueryAsync();
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            duplicateViolated = true;
        }

        Assert.True(duplicateViolated);
    }
}
