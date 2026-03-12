using LoomaPos.Domain.Common;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class ReportsEndpoints
{
    public static RouteGroupBuilder MapReportsEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/reports/daily-sales", GetDailySalesAsync)
            .WithName("GetDailySalesReport")
            .WithSummary("Gets daily sales summary for a branch.");

        group.MapGet("/reports/daily-sales/list", GetDailySalesLinesAsync)
            .WithName("GetDailySalesLinesReport")
            .WithSummary("Gets daily sales rows with optional branch and cashier filters.");

        group.MapGet("/reports/top-products", GetTopProductsAsync)
            .WithName("GetTopProductsReport")
            .WithSummary("Gets top products by quantity in date range.");

        group.MapGet("/reports/product-sales", GetTopProductsAsync)
            .WithName("GetProductSalesReport")
            .WithSummary("Alias of top products report.");

        group.MapGet("/reports/branch-sales", GetBranchSalesAsync)
            .WithName("GetBranchSalesReport")
            .WithSummary("Gets branch sales and transaction counts.");

        group.MapGet("/reports/cash-report", GetCashReportAsync)
            .WithName("GetCashReport")
            .WithSummary("Gets cashier level cash/card report.");

        group.MapGet("/reports/stock", GetStockReportAsync)
            .WithName("GetStockReport")
            .WithSummary("Gets stock report with critical markers.");

        group.MapGet("/reports/refunds", GetRefundReportAsync)
            .WithName("GetRefundReport")
            .WithSummary("Gets refund/void transactions in date range.");

        return group;
    }

    private static async Task<IResult> GetDailySalesAsync(
        DateOnly date,
        Guid branch_id,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var dayStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var dayEnd = dayStart.AddDays(1);

        var sales = await dbContext.Sales.AsNoTracking()
            .Where(x => x.BranchId == branch_id && x.CreatedAt >= dayStart && x.CreatedAt < dayEnd)
            .ToListAsync(cancellationToken);

        var result = new DailySalesReportResponse(
            date,
            branch_id,
            sales.Count,
            sales.Sum(x => x.Total),
            sales.Sum(x => x.Discount),
            sales.Sum(x => x.Tax));

        return Results.Ok(result);
    }

    private static async Task<IResult> GetDailySalesLinesAsync(
        DateOnly date,
        Guid? branch_id,
        Guid? cashier_id,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var dayStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var dayEnd = dayStart.AddDays(1);

        var query = dbContext.Sales.AsNoTracking()
            .Where(x => x.CreatedAt >= dayStart && x.CreatedAt < dayEnd);

        if (branch_id.HasValue)
        {
            query = query.Where(x => x.BranchId == branch_id.Value);
        }

        if (cashier_id.HasValue)
        {
            query = query.Where(x => x.DeviceId == cashier_id.Value);
        }

        var sales = await query
            .OrderByDescending(x => x.CreatedAt)
            .Take(1000)
            .Select(x => new
            {
                x.Id,
                x.CreatedAt,
                x.ReceiptNo,
                x.BranchId,
                x.DeviceId,
                x.Status,
                x.Total
            })
            .ToListAsync(cancellationToken);

        var branchNames = await dbContext.Branches.AsNoTracking()
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);
        var deviceNames = await dbContext.Devices.AsNoTracking()
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var rows = sales.Select(x => new DailySalesLineResponse(
            x.Id,
            x.CreatedAt,
            x.ReceiptNo,
            x.BranchId,
            branchNames.GetValueOrDefault(x.BranchId),
            x.DeviceId,
            deviceNames.GetValueOrDefault(x.DeviceId) ?? $"Kasiyer-{x.DeviceId.ToString()[..8]}",
            x.Status.ToString(),
            x.Total)).ToList();

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetTopProductsAsync(
        DateTimeOffset date_from,
        DateTimeOffset date_to,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var rows = await dbContext.Sales.AsNoTracking()
            .Where(x => x.CreatedAt >= date_from && x.CreatedAt <= date_to && x.Status == SaleStatus.Completed)
            .Join(
                dbContext.SaleLines.AsNoTracking(),
                sale => sale.Id,
                line => line.SaleId,
                (sale, line) => new { sale, line })
            .Join(
                dbContext.Products.AsNoTracking(),
                x => x.line.ProductId,
                product => product.Id,
                (x, product) => new { x.line, product })
            .GroupBy(x => new { x.product.Id, x.product.Name })
            .Select(group => new TopProductResponse(
                group.Key.Id,
                group.Key.Name,
                group.Sum(x => x.line.Qty),
                group.Sum(x => x.line.LineTotal)))
            .OrderByDescending(x => x.Quantity)
            .Take(200)
            .ToListAsync(cancellationToken);

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetBranchSalesAsync(
        DateTimeOffset date_from,
        DateTimeOffset date_to,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var rows = await dbContext.Sales.AsNoTracking()
            .Where(x => x.CreatedAt >= date_from && x.CreatedAt <= date_to && x.Status == SaleStatus.Completed)
            .GroupBy(x => x.BranchId)
            .Select(group => new
            {
                BranchId = group.Key,
                Sales = group.Sum(x => x.Total),
                Transactions = group.Count()
            })
            .ToListAsync(cancellationToken);

        var branchNames = await dbContext.Branches.AsNoTracking()
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var result = rows.Select(x => new BranchSalesReportResponse(
            x.BranchId,
            branchNames.GetValueOrDefault(x.BranchId),
            x.Sales,
            x.Transactions))
            .OrderByDescending(x => x.Sales)
            .ToList();

        return Results.Ok(result);
    }

    private static async Task<IResult> GetCashReportAsync(
        DateTimeOffset date_from,
        DateTimeOffset date_to,
        Guid? branch_id,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var salesQuery = dbContext.Sales.AsNoTracking()
            .Where(x => x.CreatedAt >= date_from && x.CreatedAt <= date_to);

        if (branch_id.HasValue)
        {
            salesQuery = salesQuery.Where(x => x.BranchId == branch_id.Value);
        }

        var sales = await salesQuery
            .Select(x => new { x.Id, x.DeviceId })
            .ToListAsync(cancellationToken);

        var saleIdToDevice = sales.ToDictionary(x => x.Id, x => x.DeviceId);
        var saleIds = sales.Select(x => x.Id).ToArray();
        if (saleIds.Length == 0)
        {
            return Results.Ok(Array.Empty<CashReportResponse>());
        }

        var payments = await dbContext.Payments.AsNoTracking()
            .Where(x => saleIds.Contains(x.SaleId))
            .ToListAsync(cancellationToken);

        var deviceNames = await dbContext.Devices.AsNoTracking()
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var rows = payments
            .GroupBy(x => saleIdToDevice[x.SaleId])
            .Select(group =>
            {
                var cash = group.Where(x => x.Method == PaymentMethod.Cash).Sum(x => x.Amount);
                var card = group.Where(x => x.Method == PaymentMethod.Card).Sum(x => x.Amount);
                return new CashReportResponse(
                    group.Key,
                    deviceNames.GetValueOrDefault(group.Key) ?? $"Kasiyer-{group.Key.ToString()[..8]}",
                    cash,
                    card,
                    cash + card);
            })
            .OrderByDescending(x => x.Total)
            .ToList();

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetStockReportAsync(
        Guid? branch_id,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var query = dbContext.StockBalances.AsNoTracking().AsQueryable();
        if (branch_id.HasValue)
        {
            query = query.Where(x => x.BranchId == branch_id.Value);
        }

        var balances = await query.ToListAsync(cancellationToken);
        var productIds = balances.Select(x => x.ProductId).Distinct().ToArray();
        var branchIds = balances.Select(x => x.BranchId).Distinct().ToArray();

        var products = productIds.Length == 0
            ? new Dictionary<Guid, (string Name, decimal MinStock)>()
            : await dbContext.Products.AsNoTracking()
                .Where(x => productIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => (x.Name, x.MinStock), cancellationToken);
        var branches = branchIds.Length == 0
            ? new Dictionary<Guid, string>()
            : await dbContext.Branches.AsNoTracking()
                .Where(x => branchIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var rows = balances.Select(x =>
            {
                var product = products.GetValueOrDefault(x.ProductId);
                var status = x.Qty <= product.MinStock ? "KRITIK" : "OK";
                return new StockReportResponse(
                    x.ProductId,
                    product.Name,
                    x.BranchId,
                    branches.GetValueOrDefault(x.BranchId),
                    x.Qty,
                    product.MinStock,
                    status);
            })
            .OrderBy(x => x.BranchName)
            .ThenBy(x => x.ProductName)
            .ToList();

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetRefundReportAsync(
        DateTimeOffset date_from,
        DateTimeOffset date_to,
        Guid? branch_id,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Sales.AsNoTracking()
            .Where(x => x.CreatedAt >= date_from && x.CreatedAt <= date_to)
            .Where(x => x.Status == SaleStatus.Refunded || x.Status == SaleStatus.Voided);

        if (branch_id.HasValue)
        {
            query = query.Where(x => x.BranchId == branch_id.Value);
        }

        var sales = await query
            .OrderByDescending(x => x.CreatedAt)
            .Take(1000)
            .Select(x => new { x.Id, x.CreatedAt, x.BranchId, x.DeviceId, x.ReceiptNo, x.Status, x.Total })
            .ToListAsync(cancellationToken);

        var branchNames = await dbContext.Branches.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);
        var deviceNames = await dbContext.Devices.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var rows = sales.Select(x => new RefundReportResponse(
                x.Id,
                x.CreatedAt,
                x.ReceiptNo,
                x.BranchId,
                branchNames.GetValueOrDefault(x.BranchId),
                x.DeviceId,
                deviceNames.GetValueOrDefault(x.DeviceId) ?? $"Kasiyer-{x.DeviceId.ToString()[..8]}",
                x.Status.ToString(),
                x.Total))
            .ToList();

        return Results.Ok(rows);
    }

    public sealed record DailySalesReportResponse(
        DateOnly Date,
        Guid BranchId,
        int SaleCount,
        decimal TotalAmount,
        decimal TotalDiscount,
        decimal TotalTax);

    public sealed record DailySalesLineResponse(
        Guid SaleId,
        DateTimeOffset Time,
        string ReceiptNo,
        Guid BranchId,
        string? BranchName,
        Guid CashierId,
        string CashierName,
        string Status,
        decimal Total);

    public sealed record TopProductResponse(
        Guid ProductId,
        string ProductName,
        decimal Quantity,
        decimal Revenue);

    public sealed record BranchSalesReportResponse(
        Guid BranchId,
        string? BranchName,
        decimal Sales,
        int Transactions);

    public sealed record CashReportResponse(
        Guid CashierId,
        string CashierName,
        decimal Cash,
        decimal Card,
        decimal Total);

    public sealed record StockReportResponse(
        Guid ProductId,
        string ProductName,
        Guid BranchId,
        string? BranchName,
        decimal Qty,
        decimal MinStock,
        string Status);

    public sealed record RefundReportResponse(
        Guid SaleId,
        DateTimeOffset Time,
        string ReceiptNo,
        Guid BranchId,
        string? BranchName,
        Guid CashierId,
        string CashierName,
        string Status,
        decimal Amount);
}

