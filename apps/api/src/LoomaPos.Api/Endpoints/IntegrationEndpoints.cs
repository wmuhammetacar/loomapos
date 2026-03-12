using System.Text.Json;
using LoomaPos.Api.Common;
using LoomaPos.Infrastructure.Integration;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class IntegrationEndpoints
{
    public static RouteGroupBuilder MapIntegrationEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/integrations/einvoice/mock/send", SendEInvoiceMockAsync)
            .WithName("SendEInvoiceMock")
            .WithSummary("Dispatches e-invoice to mock provider and logs audit trail.");

        group.MapPost("/integrations/fiscal/mock/send", SendFiscalMockAsync)
            .WithName("SendFiscalMock")
            .WithSummary("Dispatches fiscal receipt to mock provider and logs audit trail.");

        group.MapGet("/integrations/logs", GetIntegrationLogsAsync)
            .WithName("GetIntegrationLogs")
            .WithSummary("Gets latest integration logs from audit trail.");

        return group;
    }

    private static async Task<IResult> SendEInvoiceMockAsync(
        IntegrationSendRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IEInvoiceProvider provider,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "tenant context is required." });
        }

        var tenantId = tenantProvider.TenantId.Value;
        var result = await provider.SendAsync(new EInvoiceDispatchRequest(
            tenantId,
            string.IsNullOrWhiteSpace(request.Provider) ? "mock-einvoice" : request.Provider.Trim(),
            request.ReferenceNo.Trim(),
            request.PayloadJson ?? "{}"), cancellationToken);

        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId,
            "INTEGRATION_EINVOICE_DISPATCHED",
            "integrations",
            request.ReferenceNo,
            new
            {
                request.Provider,
                request.ReferenceNo,
                result.Status,
                result.ProviderRef,
                result.Message
            });
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(result);
    }

    private static async Task<IResult> SendFiscalMockAsync(
        IntegrationSendRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IFiscalProvider provider,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "tenant context is required." });
        }

        var tenantId = tenantProvider.TenantId.Value;
        var result = await provider.SendAsync(new FiscalDispatchRequest(
            tenantId,
            string.IsNullOrWhiteSpace(request.Provider) ? "mock-fiscal" : request.Provider.Trim(),
            request.ReferenceNo.Trim(),
            request.PayloadJson ?? "{}"), cancellationToken);

        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId,
            "INTEGRATION_FISCAL_DISPATCHED",
            "integrations",
            request.ReferenceNo,
            new
            {
                request.Provider,
                request.ReferenceNo,
                result.Status,
                result.ProviderRef,
                result.Message
            });
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(result);
    }

    private static async Task<IResult> GetIntegrationLogsAsync(
        int? take,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "tenant context is required." });
        }

        var rows = await dbContext.AuditLogs.AsNoTracking()
            .Where(x => x.Action.StartsWith("INTEGRATION_"))
            .OrderByDescending(x => x.CreatedAt)
            .Take(Math.Clamp(take ?? 50, 1, 200))
            .Select(x => new IntegrationLogResponse(
                x.Id,
                x.Action,
                x.EntityId,
                x.CreatedAt,
                x.PayloadJson))
            .ToListAsync(cancellationToken);

        return Results.Ok(rows.Select(row => row with
        {
            PayloadPretty = PrettyPayload(row.PayloadJson)
        }));
    }

    private static string PrettyPayload(string payloadJson)
    {
        try
        {
            var document = JsonDocument.Parse(payloadJson);
            return JsonSerializer.Serialize(document.RootElement, new JsonSerializerOptions
            {
                WriteIndented = true
            });
        }
        catch
        {
            return payloadJson;
        }
    }

    public sealed record IntegrationSendRequest(
        string ReferenceNo,
        string? Provider,
        string? PayloadJson);

    public sealed record IntegrationLogResponse(
        long Id,
        string Action,
        string EntityId,
        DateTimeOffset CreatedAt,
        string PayloadJson)
    {
        public string PayloadPretty { get; init; } = PayloadJson;
    }
}
