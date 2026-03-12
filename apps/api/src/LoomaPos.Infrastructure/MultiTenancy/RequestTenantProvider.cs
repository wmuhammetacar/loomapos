namespace LoomaPos.Infrastructure.MultiTenancy;

public sealed class RequestTenantProvider : ITenantProvider
{
    public Guid? TenantId { get; private set; }
    public Guid? BranchId { get; private set; }
    public Guid? UserId { get; private set; }
    public Guid? DeviceId { get; private set; }

    public void SetContext(Guid? tenantId, Guid? branchId, Guid? userId, Guid? deviceId)
    {
        TenantId = tenantId;
        BranchId = branchId;
        UserId = userId;
        DeviceId = deviceId;
    }
}
