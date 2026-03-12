using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Internal;

public sealed class InternalUser : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public bool RequireMfa { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class InternalUserRole : ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InternalUserId { get; set; }
    public string RoleCode { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class InternalSession : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InternalUserId { get; set; }
    public string AccessTokenHash { get; set; } = string.Empty;
    public string RefreshTokenHash { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddHours(8);
    public DateTimeOffset RefreshExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddDays(30);
    public string? UserAgent { get; set; }
    public string? IpAddress { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class AdminActionRequest : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RequestedByInternalUserId { get; set; }
    public string ActionCode { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public bool RequiresApproval { get; set; }
    public string? MetadataJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class AdminActionApproval : ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AdminActionRequestId { get; set; }
    public Guid ApprovedByInternalUserId { get; set; }
    public string Decision { get; set; } = "approved";
    public string? Note { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class SupportAccessSession : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InternalUserId { get; set; }
    public Guid? TenantId { get; set; }
    public string AccessMode { get; set; } = "shadow_view";
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public DateTimeOffset ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddMinutes(30);
    public DateTimeOffset? EndedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class SupportCase : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? CustomerAccountId { get; set; }
    public Guid? ResellerAccountId { get; set; }
    public string Source { get; set; } = "customer_portal";
    public string Category { get; set; } = "general";
    public string Priority { get; set; } = "normal";
    public string Status { get; set; } = "new";
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string? ContactPreference { get; set; }
    public string? AssigneeEmail { get; set; }
    public string? EscalationLevel { get; set; }
    public DateTimeOffset? FirstResponseAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class SupportCaseMessage : ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SupportCaseId { get; set; }
    public string AuthorType { get; set; } = "customer";
    public Guid? AuthorInternalUserId { get; set; }
    public Guid? AuthorCustomerAccountId { get; set; }
    public string Body { get; set; } = string.Empty;
    public bool IsInternal { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class SupportCaseNote : ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SupportCaseId { get; set; }
    public Guid InternalUserId { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class SupportCaseLink : ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SupportCaseId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string? Label { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
