using LoomaPos.Api.Common;
using LoomaPos.Domain.Common;
using LoomaPos.Domain.Cashbook;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class CashbookEndpoints
{
    public static RouteGroupBuilder MapCashbookEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/cashbook/transactions", GetCashTransactionsAsync)
            .WithName("GetCashTransactions")
            .WithSummary("Gets cashbook transactions by branch and date range.");

        group.MapPost("/cashbook/transactions", CreateCashTransactionAsync)
            .WithName("CreateCashTransaction")
            .WithSummary("Creates cashbook in/out transaction.");

        group.MapGet("/finance/transactions", GetCashTransactionsAsync)
            .WithName("GetFinanceTransactions")
            .WithSummary("Alias for cashbook transactions.");

        group.MapPost("/finance/transactions", CreateCashTransactionAsync)
            .WithName("CreateFinanceTransaction")
            .WithSummary("Alias for cashbook transaction create.");

        return group;
    }

    private static async Task<IResult> GetCashTransactionsAsync(
        Guid? branch_id,
        DateTimeOffset? date_from,
        DateTimeOffset? date_to,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var branchId = branch_id ?? tenantProvider.BranchId;
        if (!branchId.HasValue)
        {
            return Results.BadRequest(new { error = "branch_id is required." });
        }

        var query = dbContext.CashTransactions.AsNoTracking()
            .Where(x => x.BranchId == branchId.Value);

        if (date_from.HasValue)
        {
            query = query.Where(x => x.CreatedAt >= date_from.Value);
        }

        if (date_to.HasValue)
        {
            query = query.Where(x => x.CreatedAt <= date_to.Value);
        }

        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Take(300)
            .Select(x => new CashTransactionResponse(
                x.Id,
                x.BranchId,
                x.Type.ToString(),
                x.Amount,
                x.Reason,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Results.Ok(rows);
    }

    private static async Task<IResult> CreateCashTransactionAsync(
        CreateCashTransactionRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId ?? request.TenantId;
        var branchId = request.BranchId ?? tenantProvider.BranchId;

        if (!tenantId.HasValue || !branchId.HasValue)
        {
            return Results.BadRequest(new { error = "tenant_id and branch_id are required." });
        }

        if (!Enum.TryParse<CashTransactionType>(request.Type, true, out var transactionType))
        {
            return Results.BadRequest(new { error = "type must be IN or OUT." });
        }

        var transaction = new CashTransaction
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            Type = transactionType,
            Amount = request.Amount,
            Reason = request.Reason
        };
        dbContext.CashTransactions.Add(transaction);

        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId.Value,
            "CASH_TRANSACTION_CREATED",
            "cash_transactions",
            transaction.Id.ToString(),
            request);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new CashTransactionResponse(
            transaction.Id,
            transaction.BranchId,
            transaction.Type.ToString(),
            transaction.Amount,
            transaction.Reason,
            transaction.CreatedAt));
    }

    public sealed record CreateCashTransactionRequest(
        Guid? TenantId,
        Guid? BranchId,
        string Type,
        decimal Amount,
        string Reason);

    public sealed record CashTransactionResponse(
        Guid Id,
        Guid BranchId,
        string Type,
        decimal Amount,
        string Reason,
        DateTimeOffset CreatedAt);
}
