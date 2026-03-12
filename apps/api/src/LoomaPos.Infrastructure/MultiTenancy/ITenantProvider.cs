namespace LoomaPos.Infrastructure.MultiTenancy;

public interface ITenantProvider
{
    Guid? TenantId { get; }
    Guid? BranchId { get; }
    Guid? UserId { get; }
    Guid? DeviceId { get; }
}
