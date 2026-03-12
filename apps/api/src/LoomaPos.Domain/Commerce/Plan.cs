using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class Plan : ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal MonthlyPrice { get; set; }
    public decimal YearlyPrice { get; set; }
    public int? MaxBranches { get; set; }
    public int? MaxUsers { get; set; }
    public int? MaxDevices { get; set; }
    public string FeaturesJson { get; set; } = "[]";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
