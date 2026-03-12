using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health/live", () => Results.Ok(new
        {
            status = "live",
            utc = DateTimeOffset.UtcNow
        }))
        .WithName("Live");

        app.MapGet("/health", () => Results.Ok(new
        {
            status = "ok",
            utc = DateTimeOffset.UtcNow
        }))
        .WithName("Health");

        app.MapGet("/health/ready", async (AppDbContext dbContext, CancellationToken cancellationToken) =>
        {
            var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
            return canConnect
                ? Results.Ok(new { status = "ready" })
                : Results.Problem("Database is not reachable.", statusCode: StatusCodes.Status503ServiceUnavailable);
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
