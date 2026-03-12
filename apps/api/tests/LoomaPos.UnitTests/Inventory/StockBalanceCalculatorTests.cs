using LoomaPos.Application.Inventory;

namespace LoomaPos.UnitTests.Inventory;

public sealed class StockBalanceCalculatorTests
{
    [Fact]
    public void Calculate_ShouldUseLedgerMoves()
    {
        var opening = 10m;
        var moves = new List<decimal> { -2m, -1m, +5m, -3m };

        var balance = StockBalanceCalculator.Calculate(opening, moves);

        Assert.Equal(9m, balance);
    }
}
