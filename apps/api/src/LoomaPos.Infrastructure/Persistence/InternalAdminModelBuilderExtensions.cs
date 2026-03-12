using LoomaPos.Domain.Internal;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Infrastructure.Persistence;

public static class InternalAdminModelBuilderExtensions
{
    public static void ConfigureInternalAdminEntities(this ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<InternalUser>(entity =>
        {
            entity.ToTable("internal_users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
            entity.Property(x => x.DisplayName).HasColumnName("display_name").HasMaxLength(200).IsRequired();
            entity.Property(x => x.PasswordHash).HasColumnName("password_hash").HasMaxLength(500).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.RequireMfa).HasColumnName("require_mfa");
            entity.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.Email).IsUnique();
        });

        modelBuilder.Entity<InternalUserRole>(entity =>
        {
            entity.ToTable("internal_user_roles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.InternalUserId).HasColumnName("internal_user_id");
            entity.Property(x => x.RoleCode).HasColumnName("role_code").HasMaxLength(80).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.InternalUserId, x.RoleCode }).IsUnique();
        });

        modelBuilder.Entity<InternalSession>(entity =>
        {
            entity.ToTable("internal_sessions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.InternalUserId).HasColumnName("internal_user_id");
            entity.Property(x => x.AccessTokenHash).HasColumnName("access_token_hash").HasMaxLength(128).IsRequired();
            entity.Property(x => x.RefreshTokenHash).HasColumnName("refresh_token_hash").HasMaxLength(128).IsRequired();
            entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            entity.Property(x => x.RefreshExpiresAt).HasColumnName("refresh_expires_at");
            entity.Property(x => x.UserAgent).HasColumnName("user_agent").HasMaxLength(400);
            entity.Property(x => x.IpAddress).HasColumnName("ip_address").HasMaxLength(120);
            entity.Property(x => x.RevokedAt).HasColumnName("revoked_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.AccessTokenHash).IsUnique();
            entity.HasIndex(x => new { x.InternalUserId, x.CreatedAt });
        });

        modelBuilder.Entity<AdminActionRequest>(entity =>
        {
            entity.ToTable("admin_action_requests");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.RequestedByInternalUserId).HasColumnName("requested_by_internal_user_id");
            entity.Property(x => x.ActionCode).HasColumnName("action_code").HasMaxLength(120).IsRequired();
            entity.Property(x => x.TargetType).HasColumnName("target_type").HasMaxLength(80).IsRequired();
            entity.Property(x => x.TargetId).HasColumnName("target_id").HasMaxLength(120).IsRequired();
            entity.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(500).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.RequiresApproval).HasColumnName("requires_approval");
            entity.Property(x => x.MetadataJson).HasColumnName("metadata_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.ActionCode, x.CreatedAt });
        });

        modelBuilder.Entity<AdminActionApproval>(entity =>
        {
            entity.ToTable("admin_action_approvals");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.AdminActionRequestId).HasColumnName("admin_action_request_id");
            entity.Property(x => x.ApprovedByInternalUserId).HasColumnName("approved_by_internal_user_id");
            entity.Property(x => x.Decision).HasColumnName("decision").HasMaxLength(30).IsRequired();
            entity.Property(x => x.Note).HasColumnName("note").HasMaxLength(500);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.AdminActionRequestId, x.CreatedAt });
        });

        modelBuilder.Entity<SupportAccessSession>(entity =>
        {
            entity.ToTable("support_access_sessions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.InternalUserId).HasColumnName("internal_user_id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.AccessMode).HasColumnName("access_mode").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(500).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            entity.Property(x => x.EndedAt).HasColumnName("ended_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.InternalUserId, x.CreatedAt });
        });

        modelBuilder.Entity<SupportCase>(entity =>
        {
            entity.ToTable("support_cases");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.CustomerAccountId).HasColumnName("customer_account_id");
            entity.Property(x => x.ResellerAccountId).HasColumnName("reseller_account_id");
            entity.Property(x => x.Source).HasColumnName("source").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Category).HasColumnName("category").HasMaxLength(60).IsRequired();
            entity.Property(x => x.Priority).HasColumnName("priority").HasMaxLength(30).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(260).IsRequired();
            entity.Property(x => x.Summary).HasColumnName("summary").HasMaxLength(4000).IsRequired();
            entity.Property(x => x.ContactPreference).HasColumnName("contact_preference").HasMaxLength(60);
            entity.Property(x => x.AssigneeEmail).HasColumnName("assignee_email").HasMaxLength(320);
            entity.Property(x => x.EscalationLevel).HasColumnName("escalation_level").HasMaxLength(40);
            entity.Property(x => x.FirstResponseAt).HasColumnName("first_response_at");
            entity.Property(x => x.ResolvedAt).HasColumnName("resolved_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.Status, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
            entity.HasIndex(x => new { x.ResellerAccountId, x.CreatedAt });
        });

        modelBuilder.Entity<SupportCaseMessage>(entity =>
        {
            entity.ToTable("support_case_messages");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.SupportCaseId).HasColumnName("support_case_id");
            entity.Property(x => x.AuthorType).HasColumnName("author_type").HasMaxLength(40).IsRequired();
            entity.Property(x => x.AuthorInternalUserId).HasColumnName("author_internal_user_id");
            entity.Property(x => x.AuthorCustomerAccountId).HasColumnName("author_customer_account_id");
            entity.Property(x => x.Body).HasColumnName("body").HasMaxLength(8000).IsRequired();
            entity.Property(x => x.IsInternal).HasColumnName("is_internal");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.SupportCaseId, x.CreatedAt });
        });

        modelBuilder.Entity<SupportCaseNote>(entity =>
        {
            entity.ToTable("support_case_notes");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.SupportCaseId).HasColumnName("support_case_id");
            entity.Property(x => x.InternalUserId).HasColumnName("internal_user_id");
            entity.Property(x => x.Note).HasColumnName("note").HasMaxLength(4000).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.SupportCaseId, x.CreatedAt });
        });

        modelBuilder.Entity<SupportCaseLink>(entity =>
        {
            entity.ToTable("support_case_links");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.SupportCaseId).HasColumnName("support_case_id");
            entity.Property(x => x.EntityType).HasColumnName("entity_type").HasMaxLength(80).IsRequired();
            entity.Property(x => x.EntityId).HasColumnName("entity_id").HasMaxLength(120).IsRequired();
            entity.Property(x => x.Label).HasColumnName("label").HasMaxLength(200);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.SupportCaseId, x.EntityType, x.EntityId }).IsUnique();
        });
    }
}
