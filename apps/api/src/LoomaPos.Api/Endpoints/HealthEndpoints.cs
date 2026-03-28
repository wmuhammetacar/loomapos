using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace LoomaPos.Api.Endpoints;

public static class HealthEndpoints
{
    private const string ServiceName = "loomapos-api";

    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health/live", () =>
        {
            var now = DateTimeOffset.UtcNow;
            return Results.Ok(new
            {
                status = "alive",
                service = ServiceName,
                time = now
            });
        })
        .WithName("Live");

        app.MapGet("/health", () => Results.Ok(new
        {
            status = "ok",
            utc = DateTimeOffset.UtcNow
        }))
        .WithName("Health");

        app.MapGet("/health/ready", async (
            AppDbContext dbContext,
            IConfiguration configuration,
            IServiceProvider serviceProvider,
            ILoggerFactory loggerFactory,
            CancellationToken cancellationToken) =>
        {
            var logger = loggerFactory.CreateLogger("Health.Ready");
            var databaseStatus = "ok";
            var redisStatus = "ok";

            try
            {
                var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
                if (!canConnect)
                {
                    databaseStatus = "fail";
                    logger.LogWarning(
                        "readiness_check_failed check {CheckName} result {CheckResult} reason {Reason}",
                        "database",
                        "fail",
                        "can_connect_returned_false");
                }
            }
            catch (Exception ex)
            {
                databaseStatus = "fail";
                logger.LogWarning(
                    ex,
                    "readiness_check_failed check {CheckName} result {CheckResult} reason {Reason}",
                    "database",
                    "fail",
                    "exception");
            }

            var redisConnectionString = configuration.GetConnectionString("Redis");
            if (!string.IsNullOrWhiteSpace(redisConnectionString))
            {
                try
                {
                    var cache = serviceProvider.GetService<IDistributedCache>();
                    if (cache is null)
                    {
                        redisStatus = "fail";
                        logger.LogWarning(
                            "readiness_check_failed check {CheckName} result {CheckResult} reason {Reason}",
                            "redis",
                            "fail",
                            "cache_service_missing");
                    }
                    else
                    {
                        var probeKey = $"health:ready:{Guid.NewGuid():N}";
                        var probeValue = "ok";
                        await cache.SetStringAsync(
                            probeKey,
                            probeValue,
                            new DistributedCacheEntryOptions
                            {
                                AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(10)
                            },
                            cancellationToken);

                        var echoed = await cache.GetStringAsync(probeKey, cancellationToken);
                        if (!string.Equals(echoed, probeValue, StringComparison.Ordinal))
                        {
                            redisStatus = "fail";
                            logger.LogWarning(
                                "readiness_check_failed check {CheckName} result {CheckResult} reason {Reason}",
                                "redis",
                                "fail",
                                "probe_roundtrip_mismatch");
                        }
                    }
                }
                catch (Exception ex)
                {
                    redisStatus = "fail";
                    logger.LogWarning(
                        ex,
                        "readiness_check_failed check {CheckName} result {CheckResult} reason {Reason}",
                        "redis",
                        "fail",
                        "exception");
                }
            }

            var isReady = databaseStatus == "ok" && redisStatus == "ok";
            var payload = new
            {
                status = isReady ? "ready" : "not_ready",
                checks = new
                {
                    database = databaseStatus,
                    redis = redisStatus
                },
                time = DateTimeOffset.UtcNow
            };

            if (isReady)
            {
                logger.LogInformation(
                    "readiness_check_completed status {Status} database {DatabaseStatus} redis {RedisStatus}",
                    payload.status,
                    databaseStatus,
                    redisStatus);
                return Results.Ok(payload);
            }

            logger.LogWarning(
                "readiness_check_completed status {Status} database {DatabaseStatus} redis {RedisStatus}",
                payload.status,
                databaseStatus,
                redisStatus);

            return Results.Json(payload, statusCode: StatusCodes.Status503ServiceUnavailable);
        })
        .WithName("Ready");

        app.MapGet("/health/deep", async (AppDbContext dbContext, CancellationToken cancellationToken) =>
        {
            var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
            var migrationsPending = (await dbContext.Database.GetPendingMigrationsAsync(cancellationToken)).Any();
            return Results.Ok(new
            {
                status = canConnect && !migrationsPending ? "healthy" : "degraded",
                database = canConnect ? "reachable" : "unreachable",
                pendingMigrations = migrationsPending,
                checkedAt = DateTimeOffset.UtcNow
            });
        })
        .WithName("DeepHealth");

        return app;
    }
}
