namespace LoomaPos.Domain.Inventory;

public static class WarehouseEventTypes
{
    public const string WarehouseCreated = "warehouse_created";
    public const string StockMovedBetweenWarehouses = "stock_moved_between_warehouses";
    public const string StockAdjusted = "stock_adjusted";
    public const string WarehouseTransferCreated = "warehouse_transfer_created";
    public const string WarehouseTransferCompleted = "warehouse_transfer_completed";
}
