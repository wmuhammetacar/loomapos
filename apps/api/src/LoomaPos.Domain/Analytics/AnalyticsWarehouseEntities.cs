using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Analytics;

public sealed class AggDailySales : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public DateOnly BusinessDate { get; set; }
    public decimal GrossSales { get; set; }
    public decimal RefundAmount { get; set; }
    public decimal NetSales { get; set; }
    public int CompletedTransactionCount { get; set; }
    public int VoidCount { get; set; }
    public int EffectiveTransactionCount { get; set; }
    public decimal UnitsSold { get; set; }
    public decimal AverageBasketValue { get; set; }
    public int LowStockItemCount { get; set; }
    public int StockAdjustmentCount { get; set; }
    public DateTimeOffset SourceMaxTimestamp { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class AggBranchDailySales : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public DateOnly BusinessDate { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public decimal NetSales { get; set; }
    public decimal RefundAmount { get; set; }
    public int TransactionCount { get; set; }
    public int ActiveDeviceCount { get; set; }
    public DateTimeOffset SourceMaxTimestamp { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class AggPaymentMethodDaily : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public DateOnly BusinessDate { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public int TransactionCount { get; set; }
    public DateTimeOffset SourceMaxTimestamp { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class AggCustomerHealthSnapshot : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public int Score { get; set; }
    public string Status { get; set; } = "healthy";
    public string DriversJson { get; set; } = "[]";
    public int ActiveDevices { get; set; }
    public int FailedPayments { get; set; }
    public int OpenSupportCases { get; set; }
    public int DaysSinceLastHeartbeat { get; set; }
    public int PlanLimitPressurePercent { get; set; }
    public DateTimeOffset GeneratedAt { get; set; }
    public DateTimeOffset SourceMaxTimestamp { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class AnalyticsRefreshRun : ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Scope { get; set; } = "tenant";
    public string Status { get; set; } = "completed";
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset SourceMaxTimestamp { get; set; }
    public int RecordsWritten { get; set; }
    public string? Error { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
