namespace LoomaPos.Application.Inventory;

public static class StockBalanceCalculator
{
    public static decimal Calculate(decimal openingBalance, IReadOnlyCollection<decimal> moveDeltas)
    {
        return moveDeltas.Aggregate(openingBalance, (current, delta) => current + delta);
    }
}
