using System.Text.Json;
using LoomaPos.Domain.Auditing;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;

namespace LoomaPos.Api.Common;

internal static class AuditLogWriter
{
    public static void Add(
        AppDbContext dbContext,
        ITenantProvider tenantProvider,
        Guid tenantId,
        string action,
        string entity,
        string entityId,
        object payload)
    {
        dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            UserId = tenantProvider.UserId,
            Action = action,
            Entity = entity,
            EntityId = entityId,
            PayloadJson = JsonSerializer.Serialize(payload)
        });
    }
}
