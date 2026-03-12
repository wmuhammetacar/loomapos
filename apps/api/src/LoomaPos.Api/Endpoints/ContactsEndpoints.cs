using LoomaPos.Api.Common;
using LoomaPos.Domain.Common;
using LoomaPos.Domain.Customers;
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

        group.MapPost("/contacts", CreateContactAsync)
            .WithName("CreateContact")
            .WithSummary("Creates contact.");

        group.MapPost("/contacts/{id:guid}/ledger", AddContactLedgerAsync)
            .WithName("AddContactLedger")
            .WithSummary("Adds immutable contact ledger row.");

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
}
