using System.Text.Json;
using LoomaPos.Api.Common;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using LoomaPos.Infrastructure.Storage;
using DomainUser = LoomaPos.Domain.Identity.AppUser;
using DomainBranch = LoomaPos.Domain.Identity.Branch;
using DomainRole = LoomaPos.Domain.Identity.Role;
using DomainUserRole = LoomaPos.Domain.Identity.UserRole;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class IdentityEndpoints
{
    private static readonly IReadOnlyDictionary<string, LicenseLimitsResponse> PlanLimits =
        new Dictionary<string, LicenseLimitsResponse>(StringComparer.OrdinalIgnoreCase)
        {
            ["starter"] = new LicenseLimitsResponse(1, 3, 1),
            ["pro"] = new LicenseLimitsResponse(5, 10, 5),
            ["enterprise"] = new LicenseLimitsResponse(null, null, null)
        };

    public static RouteGroupBuilder MapIdentityEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/tenants/me", GetTenantAsync)
            .WithName("GetTenant")
            .WithSummary("Gets tenant detail from tenant context.");

        group.MapPut("/tenants/me/settings", UpdateTenantSettingsAsync)
            .WithName("UpdateTenantSettings")
            .WithSummary("Updates tenant-level settings.");

        group.MapPost("/tenants/me/logo", UploadTenantLogoAsync)
            .WithName("UploadTenantLogo")
            .WithSummary("Uploads tenant logo image.");

        group.MapGet("/license/me", GetLicenseAsync)
            .WithName("GetLicense")
            .WithSummary("Gets current tenant license details.");

        group.MapPut("/license/me", UpdateLicenseAsync)
            .WithName("UpdateLicense")
            .WithSummary("Updates tenant license plan and payment date.");

        group.MapGet("/branches", GetBranchesAsync)
            .WithName("GetBranches")
            .WithSummary("Gets branches for tenant.");

        group.MapPost("/branches", CreateBranchAsync)
            .WithName("CreateBranch")
            .WithSummary("Creates branch for tenant.");

        group.MapPatch("/branches/{id:guid}", UpdateBranchAsync)
            .WithName("UpdateBranch")
            .WithSummary("Updates branch details and branch settings.");

        group.MapGet("/roles", GetRolesAsync)
            .WithName("GetRoles")
            .WithSummary("Gets roles for tenant.");

        group.MapPost("/roles", CreateRoleAsync)
            .WithName("CreateRole")
            .WithSummary("Creates role for tenant.");

        group.MapPost("/roles/ensure-defaults", EnsureDefaultRolesAsync)
            .WithName("EnsureDefaultRoles")
            .WithSummary("Ensures default roles (Admin, Sube Yoneticisi, Kasiyer).");

        group.MapGet("/users", GetUsersAsync)
            .WithName("GetUsers")
            .WithSummary("Gets users for tenant.");

        group.MapPost("/users", CreateUserAsync)
            .WithName("CreateUser")
            .WithSummary("Creates user for tenant.");

        group.MapPatch("/users/{id:guid}", UpdateUserAsync)
            .WithName("UpdateUser")
            .WithSummary("Updates user profile, branch, active status and roles.");

        group.MapPost("/users/{userId:guid}/roles", AssignUserRolesAsync)
            .WithName("AssignUserRoles")
            .WithSummary("Replaces role assignments for user.");

        group.MapPost("/maintenance/database-backup", CreateDatabaseBackupAsync)
            .WithName("CreateDatabaseBackup")
            .WithSummary("Creates tenant JSON backup in file storage.");

        return group;
    }

    private static async Task<IResult> GetTenantAsync(
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "Tenant context is required." });
        }

        var tenant = await dbContext.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == tenantProvider.TenantId.Value, cancellationToken);
        if (tenant is null)
        {
            return Results.NotFound();
        }

        return Results.Ok(new
        {
            tenant.Id,
            tenant.Name,
            tenant.SettingsJson,
            Settings = DeserializeSettings(tenant.SettingsJson),
            tenant.CreatedAt
        });
    }

    private static async Task<IResult> UpdateTenantSettingsAsync(
        UpdateTenantSettingsRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "Tenant context is required." });
        }

        var tenantId = tenantProvider.TenantId.Value;
        var tenant = await dbContext.Tenants
            .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return Results.NotFound();
        }

        var normalizedName = request.Name?.Trim();
        if (!string.IsNullOrWhiteSpace(normalizedName))
        {
            tenant.Name = normalizedName;
        }

        var settings = BuildUpdatedSettings(
            DeserializeSettings(tenant.SettingsJson),
            NormalizeEmpty(request.Settings?.LogoUrl),
            NormalizeEmpty(request.Settings?.TaxNumber),
            NormalizeEmpty(request.Settings?.CompanyAddress),
            NormalizeEmpty(request.Settings?.CompanyPhone),
            NormalizeEmpty(request.Settings?.ReceiptFooter),
            request.Settings?.DefaultOpeningCash,
            NormalizeEmpty(request.Settings?.ReceiptPrinter),
            NormalizeEmpty(request.Settings?.Currency),
            NormalizeEmpty(request.Settings?.DefaultPaymentMethod),
            NormalizeEmpty(request.Settings?.LicensePlan),
            request.Settings?.LicenseNextPaymentDate);

        tenant.SettingsJson = JsonSerializer.Serialize(settings);
        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId,
            "TENANT_SETTINGS_UPDATED",
            "tenants",
            tenant.Id.ToString(),
            new
            {
                Name = tenant.Name,
                Settings = settings
            });
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new
        {
            tenant.Id,
            tenant.Name,
            tenant.SettingsJson,
            Settings = settings,
            tenant.CreatedAt
        });
    }

    private static async Task<IResult> UploadTenantLogoAsync(
        HttpRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IFileStorage fileStorage,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "Tenant context is required." });
        }

        if (!request.HasFormContentType)
        {
            return Results.BadRequest(new { error = "multipart/form-data is required." });
        }

        var form = await request.ReadFormAsync(cancellationToken);
        var file = form.Files.GetFile("file");
        if (file is null)
        {
            return Results.BadRequest(new { error = "file is required." });
        }

        const long maxAllowedSize = 5 * 1024 * 1024;
        if (file.Length <= 0 || file.Length > maxAllowedSize)
        {
            return Results.BadRequest(new { error = "file size must be between 1 byte and 5 MB." });
        }

        var extension = ResolveExtension(file.ContentType, file.FileName);
        if (extension is null)
        {
            return Results.BadRequest(new { error = "only png, jpeg, webp, svg and gif are supported." });
        }

        var tenantId = tenantProvider.TenantId.Value;
        var fileKey = $"tenant/{tenantId:D}/logo/{DateTimeOffset.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}{extension}";
        await using (var fileStream = file.OpenReadStream())
        {
            await fileStorage.UploadAsync(fileKey, fileStream, file.ContentType, cancellationToken);
        }

        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return Results.NotFound();
        }

        var logoUrl = $"/files/{fileKey}";
        var settings = BuildUpdatedSettings(
            DeserializeSettings(tenant.SettingsJson),
            logoUrl,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null);

        tenant.SettingsJson = JsonSerializer.Serialize(settings);
        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId,
            "TENANT_LOGO_UPLOADED",
            "tenants",
            tenant.Id.ToString(),
            new
            {
                FileKey = fileKey,
                LogoUrl = logoUrl
            });
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new
        {
            logoUrl,
            fileKey
        });
    }

    private static async Task<IResult> GetLicenseAsync(
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "Tenant context is required." });
        }

        var tenant = await dbContext.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == tenantProvider.TenantId.Value, cancellationToken);
        if (tenant is null)
        {
            return Results.NotFound();
        }

        var settings = DeserializeSettings(tenant.SettingsJson);
        var plan = NormalizePlan(settings?.LicensePlan);
        var usage = new LicenseUsageResponse(
            await dbContext.Branches.AsNoTracking().CountAsync(cancellationToken),
            await dbContext.Users.AsNoTracking().CountAsync(x => x.IsActive, cancellationToken),
            await dbContext.Devices.AsNoTracking().CountAsync(cancellationToken));

        return Results.Ok(new LicenseResponse(plan, PlanLimits[plan], usage, settings?.LicenseNextPaymentDate));
    }

    private static async Task<IResult> UpdateLicenseAsync(
        UpdateLicenseRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "Tenant context is required." });
        }

        var tenantId = tenantProvider.TenantId.Value;
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return Results.NotFound();
        }

        var plan = NormalizePlan(request.Plan);
        var settings = BuildUpdatedSettings(
            DeserializeSettings(tenant.SettingsJson),
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            plan,
            request.NextPaymentDate);

        tenant.SettingsJson = JsonSerializer.Serialize(settings);
        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId,
            "LICENSE_UPDATED",
            "tenants",
            tenant.Id.ToString(),
            new { plan, request.NextPaymentDate });
        await dbContext.SaveChangesAsync(cancellationToken);

        var usage = new LicenseUsageResponse(
            await dbContext.Branches.AsNoTracking().CountAsync(cancellationToken),
            await dbContext.Users.AsNoTracking().CountAsync(x => x.IsActive, cancellationToken),
            await dbContext.Devices.AsNoTracking().CountAsync(cancellationToken));

        return Results.Ok(new LicenseResponse(plan, PlanLimits[plan], usage, request.NextPaymentDate));
    }

    private static async Task<IResult> GetBranchesAsync(
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var branches = await dbContext.Branches.AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        var rows = branches.Select(x => new BranchResponse(
            x.Id,
            x.Name,
            x.Address,
            x.Phone,
            x.TaxNumber,
            DeserializeBranchSettings(x.SettingsJson),
            x.CreatedAt)).ToList();

        return Results.Ok(rows);
    }

    private static async Task<IResult> CreateBranchAsync(
        CreateBranchRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId ?? request.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.BadRequest(new { error = "tenant_id is required." });
        }

        var branch = new DomainBranch
        {
            TenantId = tenantId.Value,
            Name = request.Name.Trim(),
            Address = NormalizeEmpty(request.Address),
            Phone = NormalizeEmpty(request.Phone),
            TaxNumber = NormalizeEmpty(request.TaxNumber),
            SettingsJson = JsonSerializer.Serialize(new BranchSettingsResponse(
                NormalizeEmpty(request.Settings?.ReceiptHeader),
                request.Settings?.DefaultTaxRate,
                request.Settings?.OpeningCash))
        };

        dbContext.Branches.Add(branch);
        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId.Value,
            "BRANCH_CREATED",
            "branches",
            branch.Id.ToString(),
            request);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new BranchResponse(
            branch.Id,
            branch.Name,
            branch.Address,
            branch.Phone,
            branch.TaxNumber,
            DeserializeBranchSettings(branch.SettingsJson),
            branch.CreatedAt));
    }

    private static async Task<IResult> UpdateBranchAsync(
        Guid id,
        UpdateBranchRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "Tenant context is required." });
        }

        var branch = await dbContext.Branches.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (branch is null)
        {
            return Results.NotFound();
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            branch.Name = request.Name.Trim();
        }

        if (request.Address is not null)
        {
            branch.Address = NormalizeEmpty(request.Address);
        }

        if (request.Phone is not null)
        {
            branch.Phone = NormalizeEmpty(request.Phone);
        }

        if (request.TaxNumber is not null)
        {
            branch.TaxNumber = NormalizeEmpty(request.TaxNumber);
        }

        if (request.Settings is not null)
        {
            var current = DeserializeBranchSettings(branch.SettingsJson);
            branch.SettingsJson = JsonSerializer.Serialize(new BranchSettingsResponse(
                NormalizeEmpty(request.Settings.ReceiptHeader) ?? current?.ReceiptHeader,
                request.Settings.DefaultTaxRate ?? current?.DefaultTaxRate,
                request.Settings.OpeningCash ?? current?.OpeningCash));
        }

        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantProvider.TenantId.Value,
            "BRANCH_UPDATED",
            "branches",
            branch.Id.ToString(),
            request);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new BranchResponse(
            branch.Id,
            branch.Name,
            branch.Address,
            branch.Phone,
            branch.TaxNumber,
            DeserializeBranchSettings(branch.SettingsJson),
            branch.CreatedAt));
    }

    private static async Task<IResult> GetRolesAsync(
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var roles = await dbContext.Roles.AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new RoleResponse(x.Id, x.Name))
            .ToListAsync(cancellationToken);
        return Results.Ok(roles);
    }

    private static async Task<IResult> CreateRoleAsync(
        CreateRoleRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId ?? request.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.BadRequest(new { error = "tenant_id is required." });
        }

        var role = new DomainRole
        {
            TenantId = tenantId.Value,
            Name = request.Name.Trim()
        };
        dbContext.Roles.Add(role);
        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId.Value,
            "ROLE_CREATED",
            "roles",
            role.Id.ToString(),
            request);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new RoleResponse(role.Id, role.Name));
    }

    private static async Task<IResult> EnsureDefaultRolesAsync(
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "Tenant context is required." });
        }

        var defaults = new[] { "Admin", "Sube Yoneticisi", "Kasiyer" };
        var existing = await dbContext.Roles.AsNoTracking()
            .Select(x => x.Name)
            .ToListAsync(cancellationToken);
        var existingSet = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);
        var created = new List<string>();

        foreach (var name in defaults)
        {
            if (existingSet.Contains(name))
            {
                continue;
            }

            dbContext.Roles.Add(new DomainRole
            {
                TenantId = tenantProvider.TenantId.Value,
                Name = name
            });
            created.Add(name);
        }

        if (created.Count > 0)
        {
            AuditLogWriter.Add(
                dbContext,
                tenantProvider,
                tenantProvider.TenantId.Value,
                "DEFAULT_ROLES_ENSURED",
                "roles",
                "defaults",
                new { Created = created });
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Results.Ok(new { Created = created });
    }

    private static async Task<IResult> GetUsersAsync(
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var users = await dbContext.Users.AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        var userIds = users.Select(x => x.Id).ToList();
        var rolesByUserId = userIds.Count == 0
            ? new Dictionary<Guid, IReadOnlyList<UserRoleItemResponse>>()
            : (await (
                from userRole in dbContext.UserRoles.AsNoTracking()
                join role in dbContext.Roles.AsNoTracking() on userRole.RoleId equals role.Id
                where userIds.Contains(userRole.UserId)
                select new
                {
                    userRole.UserId,
                    Role = new UserRoleItemResponse(role.Id, role.Name)
                }).ToListAsync(cancellationToken))
                .GroupBy(x => x.UserId)
                .ToDictionary(
                    x => x.Key,
                    x => (IReadOnlyList<UserRoleItemResponse>)x.Select(y => y.Role).OrderBy(y => y.Name).ToList());

        var branchIds = users.Where(x => x.BranchId.HasValue).Select(x => x.BranchId!.Value).Distinct().ToArray();
        var branchNames = branchIds.Length == 0
            ? new Dictionary<Guid, string>()
            : await dbContext.Branches.AsNoTracking()
                .Where(x => branchIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var result = users.Select(user => new UserResponse(
            user.Id,
            user.Name,
            user.Email,
            user.Phone,
            user.BranchId,
            user.BranchId.HasValue ? branchNames.GetValueOrDefault(user.BranchId.Value) : null,
            user.IsActive,
            user.CreatedAt,
            rolesByUserId.GetValueOrDefault(user.Id, Array.Empty<UserRoleItemResponse>())))
            .ToList();

        return Results.Ok(result);
    }

    private static async Task<IResult> CreateUserAsync(
        CreateUserRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId ?? request.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.BadRequest(new { error = "tenant_id is required." });
        }

        if (request.BranchId.HasValue)
        {
            var hasBranch = await dbContext.Branches.AsNoTracking()
                .AnyAsync(x => x.Id == request.BranchId.Value, cancellationToken);
            if (!hasBranch)
            {
                return Results.BadRequest(new { error = "branch_id is invalid." });
            }
        }

        var user = new DomainUser
        {
            TenantId = tenantId.Value,
            Name = request.Name.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            Phone = NormalizeEmpty(request.Phone),
            BranchId = request.BranchId,
            IsActive = true
        };
        dbContext.Users.Add(user);

        var validRoleIds = await ValidateRoleIdsAsync(request.RoleIds, dbContext, cancellationToken);
        if (validRoleIds is null)
        {
            return Results.BadRequest(new { error = "One or more roles are invalid for current tenant." });
        }

        foreach (var roleId in validRoleIds)
        {
            dbContext.UserRoles.Add(new DomainUserRole
            {
                UserId = user.Id,
                RoleId = roleId
            });
        }

        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId.Value,
            "USER_CREATED",
            "users",
            user.Id.ToString(),
            new
            {
                request.Name,
                request.Email,
                request.Phone,
                request.BranchId,
                RoleIds = validRoleIds,
                PasswordProvided = !string.IsNullOrWhiteSpace(request.Password)
            });
        await dbContext.SaveChangesAsync(cancellationToken);

        string? branchName = null;
        if (user.BranchId.HasValue)
        {
            branchName = await dbContext.Branches.AsNoTracking()
                .Where(x => x.Id == user.BranchId.Value)
                .Select(x => x.Name)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var assignedRoles = await dbContext.Roles.AsNoTracking()
            .Where(x => validRoleIds!.Contains(x.Id))
            .Select(x => new UserRoleItemResponse(x.Id, x.Name))
            .ToListAsync(cancellationToken);

        return Results.Ok(new UserResponse(
            user.Id,
            user.Name,
            user.Email,
            user.Phone,
            user.BranchId,
            branchName,
            user.IsActive,
            user.CreatedAt,
            assignedRoles));
    }

    private static async Task<IResult> UpdateUserAsync(
        Guid id,
        UpdateUserRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "Tenant context is required." });
        }

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null)
        {
            return Results.NotFound();
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            user.Name = request.Name.Trim();
        }

        if (request.Phone is not null)
        {
            user.Phone = NormalizeEmpty(request.Phone);
        }

        if (request.IsActive.HasValue)
        {
            user.IsActive = request.IsActive.Value;
        }

        if (request.BranchId.HasValue)
        {
            if (request.BranchId.Value == Guid.Empty)
            {
                user.BranchId = null;
            }
            else
            {
                var hasBranch = await dbContext.Branches.AsNoTracking()
                    .AnyAsync(x => x.Id == request.BranchId.Value, cancellationToken);
                if (!hasBranch)
                {
                    return Results.BadRequest(new { error = "branch_id is invalid." });
                }

                user.BranchId = request.BranchId;
            }
        }

        if (request.RoleIds is not null)
        {
            var validRoleIds = await ValidateRoleIdsAsync(request.RoleIds, dbContext, cancellationToken);
            if (validRoleIds is null)
            {
                return Results.BadRequest(new { error = "One or more roles are invalid for current tenant." });
            }

            var existing = await dbContext.UserRoles.Where(x => x.UserId == user.Id).ToListAsync(cancellationToken);
            if (existing.Count > 0)
            {
                dbContext.UserRoles.RemoveRange(existing);
            }

            foreach (var roleId in validRoleIds)
            {
                dbContext.UserRoles.Add(new DomainUserRole
                {
                    UserId = user.Id,
                    RoleId = roleId
                });
            }
        }

        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantProvider.TenantId.Value,
            "USER_UPDATED",
            "users",
            user.Id.ToString(),
            request);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new { user.Id });
    }

    private static async Task<IResult> AssignUserRolesAsync(
        Guid userId,
        AssignUserRolesRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "Tenant context is required." });
        }

        var tenantId = tenantProvider.TenantId.Value;
        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tenantId, cancellationToken);
        if (user is null)
        {
            return Results.NotFound();
        }

        var requestedRoleIds = (request.RoleIds ?? Array.Empty<Guid>()).Distinct().ToArray();
        var validRoleIds = await dbContext.Roles.AsNoTracking()
            .Where(x => requestedRoleIds.Contains(x.Id))
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (validRoleIds.Count != requestedRoleIds.Length)
        {
            return Results.BadRequest(new { error = "One or more roles are invalid for current tenant." });
        }

        var existingUserRoles = await dbContext.UserRoles
            .Where(x => x.UserId == userId)
            .ToListAsync(cancellationToken);
        if (existingUserRoles.Count > 0)
        {
            dbContext.UserRoles.RemoveRange(existingUserRoles);
        }

        foreach (var roleId in validRoleIds)
        {
            dbContext.UserRoles.Add(new DomainUserRole
            {
                UserId = userId,
                RoleId = roleId
            });
        }

        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId,
            "USER_ROLES_UPDATED",
            "user_roles",
            userId.ToString(),
            new
            {
                RoleIds = validRoleIds
            });
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new AssignUserRolesResponse(userId, validRoleIds));
    }

    private static async Task<IResult> CreateDatabaseBackupAsync(
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IFileStorage fileStorage,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "Tenant context is required." });
        }

        var tenantId = tenantProvider.TenantId.Value;
        var backupId = Guid.NewGuid();
        var createdAt = DateTimeOffset.UtcNow;

        var snapshotBytes = JsonSerializer.SerializeToUtf8Bytes(new
        {
            backupId,
            tenantId,
            createdAt,
            counts = new
            {
                branches = await dbContext.Branches.AsNoTracking().CountAsync(cancellationToken),
                users = await dbContext.Users.AsNoTracking().CountAsync(cancellationToken),
                products = await dbContext.Products.AsNoTracking().CountAsync(cancellationToken),
                sales = await dbContext.Sales.AsNoTracking().CountAsync(cancellationToken)
            }
        }, new JsonSerializerOptions { WriteIndented = true });

        var fileKey = $"tenant/{tenantId:D}/backups/db-backup-{createdAt:yyyyMMddHHmmss}-{backupId:N}.json";
        await using (var stream = new MemoryStream(snapshotBytes, writable: false))
        {
            await fileStorage.UploadAsync(fileKey, stream, "application/json", cancellationToken);
        }

        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId,
            "DB_BACKUP_CREATED",
            "backups",
            backupId.ToString(),
            new { fileKey, createdAt });
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new DatabaseBackupResponse(backupId, fileKey, $"/files/{fileKey}", createdAt));
    }

    public sealed record CreateBranchRequest(
        Guid? TenantId,
        string Name,
        string? Address,
        string? Phone,
        string? TaxNumber,
        BranchSettingsRequest? Settings);

    public sealed record UpdateBranchRequest(
        string? Name,
        string? Address,
        string? Phone,
        string? TaxNumber,
        BranchSettingsRequest? Settings);

    public sealed record BranchResponse(
        Guid Id,
        string Name,
        string? Address,
        string? Phone,
        string? TaxNumber,
        BranchSettingsResponse? Settings,
        DateTimeOffset CreatedAt);

    public sealed record BranchSettingsRequest(
        string? ReceiptHeader,
        decimal? DefaultTaxRate,
        decimal? OpeningCash);

    public sealed record BranchSettingsResponse(
        string? ReceiptHeader,
        decimal? DefaultTaxRate,
        decimal? OpeningCash);

    public sealed record CreateRoleRequest(Guid? TenantId, string Name);
    public sealed record RoleResponse(Guid Id, string Name);

    public sealed record CreateUserRequest(
        Guid? TenantId,
        string Name,
        string Email,
        string? Phone,
        Guid? BranchId,
        string? Password,
        IReadOnlyList<Guid>? RoleIds);

    public sealed record UpdateUserRequest(
        string? Name,
        string? Phone,
        bool? IsActive,
        Guid? BranchId,
        IReadOnlyList<Guid>? RoleIds);

    public sealed record UserResponse(
        Guid Id,
        string Name,
        string Email,
        string? Phone,
        Guid? BranchId,
        string? BranchName,
        bool IsActive,
        DateTimeOffset CreatedAt,
        IReadOnlyList<UserRoleItemResponse> Roles);
    public sealed record UserRoleItemResponse(Guid Id, string Name);

    public sealed record UpdateTenantSettingsRequest(string? Name, TenantSettingsRequest? Settings);
    public sealed record TenantSettingsRequest(
        string? LogoUrl,
        string? TaxNumber,
        string? CompanyAddress,
        string? CompanyPhone,
        string? ReceiptFooter,
        decimal? DefaultOpeningCash,
        string? ReceiptPrinter,
        string? Currency,
        string? DefaultPaymentMethod,
        string? LicensePlan,
        DateOnly? LicenseNextPaymentDate);
    public sealed record TenantSettingsResponse(
        string? LogoUrl,
        string? TaxNumber,
        string? CompanyAddress,
        string? CompanyPhone,
        string? ReceiptFooter,
        decimal? DefaultOpeningCash,
        string? ReceiptPrinter,
        string? Currency,
        string? DefaultPaymentMethod,
        string? LicensePlan,
        DateOnly? LicenseNextPaymentDate);

    public sealed record AssignUserRolesRequest(IReadOnlyList<Guid>? RoleIds);
    public sealed record AssignUserRolesResponse(Guid UserId, IReadOnlyList<Guid> RoleIds);

    public sealed record LicenseResponse(
        string Plan,
        LicenseLimitsResponse Limits,
        LicenseUsageResponse Usage,
        DateOnly? NextPaymentDate);

    public sealed record LicenseLimitsResponse(
        int? MaxBranches,
        int? MaxUsers,
        int? MaxDevices);

    public sealed record LicenseUsageResponse(
        int Branches,
        int Users,
        int Devices);

    public sealed record UpdateLicenseRequest(
        string Plan,
        DateOnly? NextPaymentDate);

    public sealed record DatabaseBackupResponse(
        Guid BackupId,
        string FileKey,
        string FileUrl,
        DateTimeOffset CreatedAt);

    private static TenantSettingsResponse? DeserializeSettings(string? settingsJson)
    {
        if (string.IsNullOrWhiteSpace(settingsJson))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<TenantSettingsResponse>(settingsJson);
        }
        catch
        {
            return null;
        }
    }

    private static BranchSettingsResponse? DeserializeBranchSettings(string? settingsJson)
    {
        if (string.IsNullOrWhiteSpace(settingsJson))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<BranchSettingsResponse>(settingsJson);
        }
        catch
        {
            return null;
        }
    }

    private static async Task<IReadOnlyList<Guid>?> ValidateRoleIdsAsync(
        IReadOnlyList<Guid>? roleIds,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var requestedRoleIds = (roleIds ?? Array.Empty<Guid>()).Distinct().ToArray();
        if (requestedRoleIds.Length == 0)
        {
            return [];
        }

        var validRoleIds = await dbContext.Roles.AsNoTracking()
            .Where(x => requestedRoleIds.Contains(x.Id))
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        return validRoleIds.Count == requestedRoleIds.Length ? validRoleIds : null;
    }

    private static string? NormalizeEmpty(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private static string NormalizePlan(string? plan)
    {
        var normalized = plan?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return "starter";
        }

        return PlanLimits.ContainsKey(normalized) ? normalized : "starter";
    }

    private static TenantSettingsResponse BuildUpdatedSettings(
        TenantSettingsResponse? currentSettings,
        string? logoUrl,
        string? taxNumber,
        string? companyAddress,
        string? companyPhone,
        string? receiptFooter,
        decimal? defaultOpeningCash,
        string? receiptPrinter,
        string? currency,
        string? defaultPaymentMethod,
        string? licensePlan,
        DateOnly? licenseNextPaymentDate)
    {
        return new TenantSettingsResponse(
            logoUrl ?? currentSettings?.LogoUrl,
            taxNumber ?? currentSettings?.TaxNumber,
            companyAddress ?? currentSettings?.CompanyAddress,
            companyPhone ?? currentSettings?.CompanyPhone,
            receiptFooter ?? currentSettings?.ReceiptFooter,
            defaultOpeningCash ?? currentSettings?.DefaultOpeningCash,
            receiptPrinter ?? currentSettings?.ReceiptPrinter,
            currency ?? currentSettings?.Currency,
            defaultPaymentMethod ?? currentSettings?.DefaultPaymentMethod,
            NormalizePlan(licensePlan ?? currentSettings?.LicensePlan),
            licenseNextPaymentDate ?? currentSettings?.LicenseNextPaymentDate);
    }

    private static string? ResolveExtension(string? contentType, string fileName)
    {
        var normalizedContentType = contentType?.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(normalizedContentType))
        {
            return normalizedContentType switch
            {
                "image/png" => ".png",
                "image/jpeg" => ".jpg",
                "image/webp" => ".webp",
                "image/svg+xml" => ".svg",
                "image/gif" => ".gif",
                _ => null
            };
        }

        var fileExtension = Path.GetExtension(fileName).ToLowerInvariant();
        return fileExtension is ".png" or ".jpg" or ".jpeg" or ".webp" or ".svg" or ".gif"
            ? (fileExtension == ".jpeg" ? ".jpg" : fileExtension)
            : null;
    }
}
