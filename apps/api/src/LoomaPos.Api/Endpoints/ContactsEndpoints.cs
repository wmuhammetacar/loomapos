using LoomaPos.Api.Common;
using LoomaPos.Api.Commerce;
using LoomaPos.Domain.Common;
using LoomaPos.Domain.Customers;
using LoomaPos.Infrastructure.Customers;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class ContactsEndpoints
{
    public static RouteGroupBuilder MapContactsEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/contacts", GetContactsAsync)
            .WithName("GetContacts")
            .WithSummary("Gets contacts.");

        group.MapGet("/contacts/{id:guid}/ledger", GetContactLedgerAsync)
            .WithName("GetContactLedger")
            .WithSummary("Gets contact ledger entries.");

        group.MapGet("/contacts/{id:guid}/account", GetCustomerAccountSummaryAsync)
            .WithName("GetCustomerAccountSummary")
            .WithSummary("Gets customer current-account summary.");

        group.MapGet("/contacts/{id:guid}/account/entries", GetCustomerAccountEntriesAsync)
            .WithName("GetCustomerAccountEntries")
            .WithSummary("Gets append-only customer current-account entries.");

        group.MapPost("/contacts", CreateContactAsync)
            .WithName("CreateContact")
            .WithSummary("Creates contact.");

        group.MapPost("/contacts/{id:guid}/ledger", AddContactLedgerAsync)
            .WithName("AddContactLedger")
            .WithSummary("Adds immutable contact ledger row.");

        group.MapPost("/contacts/{id:guid}/account/charges/sale", ChargeSaleToCustomerAccountAsync)
            .WithName("ChargeSaleToCustomerAccount")
            .WithSummary("Creates sale_charge entry for customer current-account.");

        group.MapPost("/contacts/{id:guid}/account/collections", RecordCustomerCollectionAsync)
            .WithName("RecordCustomerCollection")
            .WithSummary("Creates collection entry and decreases receivable.");

        group.MapPost("/contacts/{id:guid}/account/adjustments", RecordCustomerAccountAdjustmentAsync)
            .WithName("RecordCustomerAccountAdjustment")
            .WithSummary("Creates manual adjustment entry.");

        group.MapPost("/contacts/{id:guid}/account/refund-credits", RecordCustomerRefundCreditAsync)
            .WithName("RecordCustomerRefundCredit")
            .WithSummary("Creates refund_credit entry and decreases receivable.");

        return group;
    }

    private static async Task<IResult> GetContactsAsync(
        string? type,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Contacts.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(type))
        {
            query = query.Where(x => x.Type.ToString().ToLower() == type.ToLower());
        }

        var contacts = await query
            .OrderBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.Name,
                Type = x.Type.ToString(),
                x.Phone,
                x.Email
            })
            .ToListAsync(cancellationToken);

        var contactIds = contacts.Select(x => x.Id).ToArray();
        var summaries = contactIds.Length == 0
            ? new Dictionary<Guid, (decimal Balance, DateTimeOffset? LastTransactionAt)>()
            : (await dbContext.ContactLedger.AsNoTracking()
                .Where(x => contactIds.Contains(x.ContactId))
                .GroupBy(x => x.ContactId)
                .Select(group => new
                {
                    ContactId = group.Key,
                    Balance = group.Sum(item => item.AmountDelta),
                    LastTransactionAt = group.Max(item => item.CreatedAt)
                })
                .ToListAsync(cancellationToken))
                .ToDictionary(
                    x => x.ContactId,
                    x => ((decimal)x.Balance, (DateTimeOffset?)x.LastTransactionAt));

        var rows = contacts.Select(contact =>
        {
            var (balance, lastTransactionAt) = summaries.GetValueOrDefault(contact.Id, (0m, null));
            return new ContactResponse(
                contact.Id,
                contact.Name,
                contact.Type,
                contact.Phone,
                contact.Email,
                balance,
                lastTransactionAt);
        }).ToList();

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetContactLedgerAsync(
        Guid id,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var contactExists = await dbContext.Contacts.AsNoTracking().AnyAsync(x => x.Id == id, cancellationToken);
        if (!contactExists)
        {
            return Results.NotFound();
        }

        var rows = await dbContext.ContactLedger.AsNoTracking()
            .Where(x => x.ContactId == id)
            .OrderByDescending(x => x.CreatedAt)
            .Take(500)
            .Select(x => new ContactLedgerResponse(
                x.Id,
                x.AmountDelta,
                x.Reason,
                x.RefType,
                x.RefId,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetCustomerAccountSummaryAsync(
        Guid id,
        ITenantProvider tenantProvider,
        ICustomerCurrentAccountService customerCurrentAccountService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        try
        {
            var account = await customerCurrentAccountService.GetSummaryAsync(
                tenantId.Value,
                id,
                cancellationToken);

            return Results.Ok(new CustomerAccountSummaryResponse(
                account.Id,
                account.TenantId,
                account.CustomerId,
                account.Balance,
                account.Currency,
                account.UpdatedAt));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> GetCustomerAccountEntriesAsync(
        Guid id,
        int? take,
        ITenantProvider tenantProvider,
        ICustomerCurrentAccountService customerCurrentAccountService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        try
        {
            var entries = await customerCurrentAccountService.GetEntriesAsync(
                tenantId.Value,
                id,
                take ?? 100,
                cancellationToken);

            var rows = entries.Select(x => new CustomerAccountEntryResponse(
                x.Id,
                x.Type,
                x.Amount,
                x.RefType,
                x.RefId,
                x.CreatedAt,
                x.Note)).ToList();

            return Results.Ok(rows);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> CreateContactAsync(
        CreateContactRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId ?? request.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.BadRequest(new { error = "tenant_id is required." });
        }

        if (!TryParseContactType(request.Type, out var contactType))
        {
            return Results.BadRequest(new { error = "type must be customer or supplier." });
        }

        var contact = new Contact
        {
            TenantId = tenantId.Value,
            Type = contactType,
            Name = request.Name.Trim(),
            Phone = request.Phone?.Trim(),
            Email = request.Email?.Trim()
        };

        dbContext.Contacts.Add(contact);
        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId.Value,
            "CONTACT_CREATED",
            "contacts",
            contact.Id.ToString(),
            request);

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new ContactResponse(contact.Id, contact.Name, contact.Type.ToString(), contact.Phone, contact.Email, 0, null));
    }

    private static async Task<IResult> AddContactLedgerAsync(
        Guid id,
        AddContactLedgerRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId ?? request.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.BadRequest(new { error = "tenant_id is required." });
        }

        var contact = await dbContext.Contacts.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (contact is null)
        {
            return Results.NotFound();
        }

        var ledgerRow = new ContactLedger
        {
            TenantId = tenantId.Value,
            ContactId = id,
            AmountDelta = request.AmountDelta,
            Reason = request.Reason.Trim(),
            RefType = string.IsNullOrWhiteSpace(request.RefType) ? "manual" : request.RefType.Trim(),
            RefId = string.IsNullOrWhiteSpace(request.RefId) ? Guid.NewGuid().ToString("N") : request.RefId.Trim()
        };

        dbContext.ContactLedger.Add(ledgerRow);
        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId.Value,
            "CONTACT_LEDGER_ADDED",
            "contact_ledger",
            ledgerRow.Id.ToString(),
            request);

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { ledgerRow.Id });
    }

    private static async Task<IResult> ChargeSaleToCustomerAccountAsync(
        Guid id,
        ChargeSaleToCustomerAccountRequest request,
        ITenantProvider tenantProvider,
        ICustomerCurrentAccountService customerCurrentAccountService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        try
        {
            var entry = await customerCurrentAccountService.ChargeSaleAsync(
                tenantId.Value,
                id,
                request.SaleId,
                request.Amount,
                request.Note,
                cancellationToken);

            return Results.Ok(MapAccountEntry(entry));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> RecordCustomerCollectionAsync(
        Guid id,
        RecordCustomerCollectionRequest request,
        ITenantProvider tenantProvider,
        ICustomerCurrentAccountService customerCurrentAccountService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        try
        {
            var entry = await customerCurrentAccountService.RecordCollectionAsync(
                tenantId.Value,
                id,
                request.Amount,
                request.ReferenceType,
                request.ReferenceId,
                request.Note,
                cancellationToken);

            return Results.Ok(MapAccountEntry(entry));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> RecordCustomerAccountAdjustmentAsync(
        Guid id,
        RecordCustomerAdjustmentRequest request,
        ITenantProvider tenantProvider,
        ICustomerCurrentAccountService customerCurrentAccountService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        try
        {
            var entry = await customerCurrentAccountService.RecordAdjustmentAsync(
                tenantId.Value,
                id,
                request.AmountDelta,
                request.ReferenceType,
                request.ReferenceId,
                request.Note,
                cancellationToken);

            return Results.Ok(MapAccountEntry(entry));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> RecordCustomerRefundCreditAsync(
        Guid id,
        RecordCustomerRefundCreditRequest request,
        ITenantProvider tenantProvider,
        ICustomerCurrentAccountService customerCurrentAccountService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        try
        {
            var entry = await customerCurrentAccountService.RecordRefundCreditAsync(
                tenantId.Value,
                id,
                request.Amount,
                request.ReferenceType,
                request.ReferenceId,
                request.Note,
                cancellationToken);

            return Results.Ok(MapAccountEntry(entry));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static CustomerAccountEntryResponse MapAccountEntry(CustomerCurrentAccountEntry entry)
    {
        return new CustomerAccountEntryResponse(
            entry.Id,
            entry.Type,
            entry.Amount,
            entry.RefType,
            entry.RefId,
            entry.CreatedAt,
            entry.Note);
    }

    private static bool TryParseContactType(string value, out ContactType contactType)
    {
        if (string.Equals(value, "customer", StringComparison.OrdinalIgnoreCase))
        {
            contactType = ContactType.Customer;
            return true;
        }

        if (string.Equals(value, "supplier", StringComparison.OrdinalIgnoreCase))
        {
            contactType = ContactType.Supplier;
            return true;
        }

        contactType = default;
        return false;
    }

    private static async Task<IResult?> EnsureLifecycleWriteAllowedAsync(
        Guid tenantId,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenant = await dbContext.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
        var subscription = await dbContext.Subscriptions.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        var license = await dbContext.IssuedLicenses.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.IssuedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var lifecycleState = SubscriptionLifecyclePolicy.ResolveState(tenant, subscription, license, DateTimeOffset.UtcNow);
        var lifecycle = SubscriptionLifecyclePolicy.Describe(lifecycleState);
        if (lifecycle.CanWrite)
        {
            return null;
        }

        return Results.Json(new
        {
            error = "subscription_state_blocked",
            lifecycleState = lifecycle.State,
            lifecycleLabel = lifecycle.Label,
            lifecycleMessage = lifecycle.Message,
            allowedActions = lifecycle.AllowedActions,
            blockedActions = lifecycle.BlockedActions,
            canCheckout = lifecycle.CanCheckout,
            canWrite = lifecycle.CanWrite,
            canSync = lifecycle.CanSync,
            canView = lifecycle.CanView,
            requiresUpgradeAction = lifecycle.RequiresUpgradeAction,
            requiresBlock = lifecycle.RequiresBlock
        }, statusCode: StatusCodes.Status403Forbidden);
    }

    public sealed record ContactResponse(
        Guid Id,
        string Name,
        string Type,
        string? Phone,
        string? Email,
        decimal Balance,
        DateTimeOffset? LastTransactionAt);

    public sealed record ContactLedgerResponse(
        Guid Id,
        decimal AmountDelta,
        string Reason,
        string RefType,
        string RefId,
        DateTimeOffset CreatedAt);

    public sealed record CustomerAccountSummaryResponse(
        Guid AccountId,
        Guid TenantId,
        Guid CustomerId,
        decimal Balance,
        string Currency,
        DateTimeOffset UpdatedAt);

    public sealed record CustomerAccountEntryResponse(
        Guid Id,
        string Type,
        decimal Amount,
        string RefType,
        string RefId,
        DateTimeOffset CreatedAt,
        string? Note);

    public sealed record CreateContactRequest(
        Guid? TenantId,
        string Type,
        string Name,
        string? Phone,
        string? Email);

    public sealed record AddContactLedgerRequest(
        Guid? TenantId,
        decimal AmountDelta,
        string Reason,
        string? RefType,
        string? RefId);

    public sealed record ChargeSaleToCustomerAccountRequest(
        Guid SaleId,
        decimal? Amount,
        string? Note);

    public sealed record RecordCustomerCollectionRequest(
        decimal Amount,
        string? ReferenceType,
        string? ReferenceId,
        string? Note);

    public sealed record RecordCustomerAdjustmentRequest(
        decimal AmountDelta,
        string? ReferenceType,
        string? ReferenceId,
        string? Note);

    public sealed record RecordCustomerRefundCreditRequest(
        decimal Amount,
        string? ReferenceType,
        string? ReferenceId,
        string? Note);
}
