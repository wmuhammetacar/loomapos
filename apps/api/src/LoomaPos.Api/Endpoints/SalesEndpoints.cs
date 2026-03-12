using LoomaPos.Domain.Sales;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class SalesEndpoints
{
    public static RouteGroupBuilder MapSalesEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/sales", GetSalesAsync)
            .WithName("GetSales")
            .WithSummary("Lists sales by date range and branch.");

        group.MapGet("/sales/{id:guid}", GetSaleByIdAsync)
            .WithName("GetSaleById")
            .WithSummary("Gets sale detail.");

        return group;
    }

    private static async Task<IResult> GetSalesAsync(
        DateTimeOffset? date_from,
        DateTimeOffset? date_to,
        Guid? branch_id,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Sales.AsNoTracking().AsQueryable();

        if (date_from.HasValue)
        {
            query = query.Where(x => x.CreatedAt >= date_from.Value);
        }

        if (date_to.HasValue)
        {
            query = query.Where(x => x.CreatedAt <= date_to.Value);
        }

        if (branch_id.HasValue)
        {
            query = query.Where(x => x.BranchId == branch_id.Value);
        }

        var sales = await query
            .OrderByDescending(x => x.CreatedAt)
            .Take(300)
            .Select(x => new SaleListItemResponse(
                x.Id,
                x.BranchId,
                x.DeviceId,
                x.ReceiptNo,
                x.Status.ToString(),
                x.Total,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Results.Ok(sales);
    }

    private static async Task<IResult> GetSaleByIdAsync(
        Guid id,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var sale = await dbContext.Sales.AsNoTracking()
            .Include(x => x.Lines)
            .Include(x => x.Payments)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (sale is null)
        {
            return Results.NotFound();
        }

        return Results.Ok(new SaleDetailResponse(
            sale.Id,
            sale.BranchId,
            sale.DeviceId,
            sale.ReceiptNo,
            sale.Status.ToString(),
            sale.Subtotal,
            sale.Discount,
            sale.Tax,
            sale.Total,
            sale.CreatedAt,
            sale.Lines.Select(line => new SaleLineResponse(
                line.Id,
                line.ProductId,
                line.Qty,
                line.UnitPrice,
                line.Discount,
                line.Tax,
                line.LineTotal)).ToList(),
            sale.Payments.Select(payment => new PaymentResponse(
                payment.Id,
                payment.Method.ToString(),
                payment.Amount,
                payment.CreatedAt)).ToList()));
    }

    public sealed record SaleListItemResponse(
        Guid Id,
        Guid BranchId,
        Guid DeviceId,
        string ReceiptNo,
        string Status,
        decimal Total,
        DateTimeOffset CreatedAt);

    public sealed record SaleDetailResponse(
        Guid Id,
        Guid BranchId,
        Guid DeviceId,
        string ReceiptNo,
        string Status,
        decimal Subtotal,
        decimal Discount,
        decimal Tax,
        decimal Total,
        DateTimeOffset CreatedAt,
        IReadOnlyList<SaleLineResponse> Lines,
        IReadOnlyList<PaymentResponse> Payments);

    public sealed record SaleLineResponse(
        Guid Id,
        Guid ProductId,
        decimal Qty,
        decimal UnitPrice,
        decimal Discount,
        decimal Tax,
        decimal LineTotal);

    public sealed record PaymentResponse(
        Guid Id,
        string Method,
        decimal Amount,
        DateTimeOffset CreatedAt);
}
