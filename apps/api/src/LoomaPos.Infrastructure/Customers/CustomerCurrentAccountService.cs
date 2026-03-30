using System.Text.Json;
using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Common;
using LoomaPos.Domain.Customers;
using LoomaPos.Domain.Accounting;
using LoomaPos.Infrastructure.Persistence;
using LoomaPos.Infrastructure.Accounting;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace LoomaPos.Infrastructure.Customers;

public interface ICustomerCurrentAccountService
{
    Task<CustomerCurrentAccount> GetSummaryAsync(
        Guid tenantId,
        Guid customerId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<CustomerCurrentAccountEntry>> GetEntriesAsync(
        Guid tenantId,
        Guid customerId,
        int take,
        CancellationToken cancellationToken);

    Task<CustomerCurrentAccountEntry> ChargeSaleAsync(
        Guid tenantId,
        Guid customerId,
        Guid saleId,
        decimal? amountOverride,
        string? note,
        CancellationToken cancellationToken);

    Task<CustomerCurrentAccountEntry> RecordCollectionAsync(
        Guid tenantId,
        Guid customerId,
        decimal amount,
        string? referenceType,
        string? referenceId,
        string? note,
        CancellationToken cancellationToken);

    Task<CustomerCurrentAccountEntry> RecordAdjustmentAsync(
        Guid tenantId,
        Guid customerId,
        decimal amountDelta,
        string? referenceType,
        string? referenceId,
        string? note,
        CancellationToken cancellationToken);

    Task<CustomerCurrentAccountEntry> RecordRefundCreditAsync(
        Guid tenantId,
        Guid customerId,
        decimal amount,
        string? referenceType,
        string? referenceId,
        string? note,
        CancellationToken cancellationToken);
}

public sealed class CustomerCurrentAccountService(AppDbContext dbContext, IAccountingBridgeService accountingBridgeService) : ICustomerCurrentAccountService
{
    public async Task<CustomerCurrentAccount> GetSummaryAsync(
        Guid tenantId,
        Guid customerId,
        CancellationToken cancellationToken)
    {
        await ResolveCustomerAsync(tenantId, customerId, cancellationToken);
        await EnsureAccountExistsAsync(tenantId, customerId, cancellationToken);

        return await dbContext.CustomerCurrentAccounts
            .AsNoTracking()
            .FirstAsync(x => x.TenantId == tenantId && x.CustomerId == customerId, cancellationToken);
    }

    public async Task<IReadOnlyList<CustomerCurrentAccountEntry>> GetEntriesAsync(
        Guid tenantId,
        Guid customerId,
        int take,
        CancellationToken cancellationToken)
    {
        await ResolveCustomerAsync(tenantId, customerId, cancellationToken);

        var safeTake = take <= 0 ? 100 : Math.Min(take, 500);
        return await dbContext.CustomerCurrentAccountEntries
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.CustomerId == customerId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(safeTake)
            .ToListAsync(cancellationToken);
    }

    public async Task<CustomerCurrentAccountEntry> ChargeSaleAsync(
        Guid tenantId,
        Guid customerId,
        Guid saleId,
        decimal? amountOverride,
        string? note,
        CancellationToken cancellationToken)
    {
        var sale = await dbContext.Sales
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == saleId && x.TenantId == tenantId, cancellationToken);

        if (sale is null)
        {
            throw new InvalidOperationException("sale not found for tenant.");
        }

        var amount = amountOverride ?? sale.Total;
        if (amount <= 0)
        {
            throw new InvalidOperationException("sale charge amount must be greater than zero.");
        }

        return await AppendEntryAsync(
            tenantId,
            customerId,
            CustomerCurrentAccountEntryTypes.SaleCharge,
            Math.Abs(amount),
            "sale",
            saleId.ToString(),
            note,
            cancellationToken);
    }

    public Task<CustomerCurrentAccountEntry> RecordCollectionAsync(
        Guid tenantId,
        Guid customerId,
        decimal amount,
        string? referenceType,
        string? referenceId,
        string? note,
        CancellationToken cancellationToken)
    {
        if (amount <= 0)
        {
            throw new InvalidOperationException("collection amount must be greater than zero.");
        }

        return AppendEntryAsync(
            tenantId,
            customerId,
            CustomerCurrentAccountEntryTypes.Collection,
            -Math.Abs(amount),
            NormalizeReferenceType(referenceType, "collection"),
            NormalizeReferenceId(referenceId),
            note,
            cancellationToken);
    }

    public Task<CustomerCurrentAccountEntry> RecordAdjustmentAsync(
        Guid tenantId,
        Guid customerId,
        decimal amountDelta,
        string? referenceType,
        string? referenceId,
        string? note,
        CancellationToken cancellationToken)
    {
        if (amountDelta == 0)
        {
            throw new InvalidOperationException("adjustment amountDelta must not be zero.");
        }

        return AppendEntryAsync(
            tenantId,
            customerId,
            CustomerCurrentAccountEntryTypes.Adjustment,
            amountDelta,
            NormalizeReferenceType(referenceType, "adjustment"),
            NormalizeReferenceId(referenceId),
            note,
            cancellationToken);
    }

    public Task<CustomerCurrentAccountEntry> RecordRefundCreditAsync(
        Guid tenantId,
        Guid customerId,
        decimal amount,
        string? referenceType,
        string? referenceId,
        string? note,
        CancellationToken cancellationToken)
    {
        if (amount <= 0)
        {
            throw new InvalidOperationException("refund credit amount must be greater than zero.");
        }

        return AppendEntryAsync(
            tenantId,
            customerId,
            CustomerCurrentAccountEntryTypes.RefundCredit,
            -Math.Abs(amount),
            NormalizeReferenceType(referenceType, "refund"),
            NormalizeReferenceId(referenceId),
            note,
            cancellationToken);
    }

    private async Task<CustomerCurrentAccountEntry> AppendEntryAsync(
        Guid tenantId,
        Guid customerId,
        string entryType,
        decimal amount,
        string referenceType,
        string referenceId,
        string? note,
        CancellationToken cancellationToken)
    {
        if (CustomerCurrentAccountEntryTypes.All.Contains(entryType, StringComparer.Ordinal) == false)
        {
            throw new InvalidOperationException("unsupported customer account entry type.");
        }

        var customer = await ResolveCustomerAsync(tenantId, customerId, cancellationToken);
        await EnsureAccountExistsAsync(tenantId, customerId, cancellationToken);

        var existing = await dbContext.CustomerCurrentAccountEntries
            .FirstOrDefaultAsync(
                x => x.TenantId == tenantId &&
                     x.CustomerId == customerId &&
                     x.Type == entryType &&
                     x.RefType == referenceType &&
                     x.RefId == referenceId,
                cancellationToken);

        if (existing is not null)
        {
            await QueueAccountingBridgeIfNeededAsync(tenantId, existing, cancellationToken);
            return existing;
        }

        var account = await dbContext.CustomerCurrentAccounts
            .FirstAsync(x => x.TenantId == tenantId && x.CustomerId == customerId, cancellationToken);

        var previousBalance = account.Balance;
        account.Balance += amount;

        var entry = new CustomerCurrentAccountEntry
        {
            TenantId = tenantId,
            CustomerId = customerId,
            Type = entryType,
            Amount = amount,
            RefType = referenceType,
            RefId = referenceId,
            Note = NormalizeNote(note)
        };

        dbContext.CustomerCurrentAccountEntries.Add(entry);
        dbContext.ContactLedger.Add(new ContactLedger
        {
            TenantId = tenantId,
            ContactId = customerId,
            AmountDelta = amount,
            Reason = entryType,
            RefType = referenceType,
            RefId = referenceId
        });

        dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            Action = ResolveAuditAction(entryType),
            Entity = "customer_account_entries",
            EntityId = entry.Id.ToString(),
            PayloadJson = JsonSerializer.Serialize(new
            {
                entry.Id,
                entry.TenantId,
                entry.CustomerId,
                customer.Name,
                entry.Type,
                entry.Amount,
                entry.RefType,
                entry.RefId,
                entry.Note,
                balanceBefore = previousBalance,
                balanceAfter = account.Balance,
                entry.CreatedAt
            })
        });

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await QueueAccountingBridgeIfNeededAsync(tenantId, entry, cancellationToken);
            return entry;
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            dbContext.ChangeTracker.Clear();
            var persistedEntry = await dbContext.CustomerCurrentAccountEntries
                .FirstAsync(
                    x => x.TenantId == tenantId &&
                         x.CustomerId == customerId &&
                         x.Type == entryType &&
                         x.RefType == referenceType &&
                         x.RefId == referenceId,
                    cancellationToken);

            await QueueAccountingBridgeIfNeededAsync(tenantId, persistedEntry, cancellationToken);
            return persistedEntry;
        }
    }

    private async Task QueueAccountingBridgeIfNeededAsync(
        Guid tenantId,
        CustomerCurrentAccountEntry entry,
        CancellationToken cancellationToken)
    {
        var (sourceType, eventCode) = ResolveAccountingBridgeSource(entry.Type);
        if (sourceType is null || eventCode is null)
        {
            return;
        }

        await accountingBridgeService.EnsurePendingExportItemAsync(
            tenantId,
            sourceType,
            entry.Id.ToString(),
            eventCode,
            JsonSerializer.Serialize(new
            {
                entry.Id,
                entry.TenantId,
                entry.CustomerId,
                entry.Type,
                entry.Amount,
                entry.RefType,
                entry.RefId,
                entry.CreatedAt,
                entry.Note
            }),
            cancellationToken);
    }

    private static (string? SourceType, string? EventCode) ResolveAccountingBridgeSource(string entryType)
    {
        return entryType switch
        {
            CustomerCurrentAccountEntryTypes.Collection => (AccountingBridgeSourceTypes.CustomerCollection, CustomerCurrentAccountEventTypes.CustomerCollectionRecorded),
            CustomerCurrentAccountEntryTypes.Adjustment => (AccountingBridgeSourceTypes.CustomerAccountAdjustment, CustomerCurrentAccountEventTypes.CustomerAccountAdjusted),
            CustomerCurrentAccountEntryTypes.RefundCredit => (AccountingBridgeSourceTypes.CustomerAccountAdjustment, CustomerCurrentAccountEventTypes.CustomerAccountAdjusted),
            _ => (null, null)
        };
    }

    private async Task EnsureAccountExistsAsync(Guid tenantId, Guid customerId, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var currency = "TRY";

        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO customer_current_accounts (id, tenant_id, customer_id, balance, currency, updated_at)
            VALUES ({Guid.NewGuid()}, {tenantId}, {customerId}, {0m}, {currency}, {now})
            ON CONFLICT (tenant_id, customer_id) DO NOTHING;
            """, cancellationToken);
    }

    private async Task<Contact> ResolveCustomerAsync(Guid tenantId, Guid customerId, CancellationToken cancellationToken)
    {
        var customer = await dbContext.Contacts
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.Id == customerId && x.TenantId == tenantId,
                cancellationToken);

        if (customer is null)
        {
            throw new InvalidOperationException("customer not found for tenant.");
        }

        if (customer.Type != ContactType.Customer)
        {
            throw new InvalidOperationException("contact must be customer type for current-account operations.");
        }

        return customer;
    }

    private static string NormalizeReferenceType(string? referenceType, string fallback)
    {
        return string.IsNullOrWhiteSpace(referenceType)
            ? fallback
            : referenceType.Trim().ToLowerInvariant();
    }

    private static string NormalizeReferenceId(string? referenceId)
    {
        return string.IsNullOrWhiteSpace(referenceId)
            ? Guid.NewGuid().ToString("N")
            : referenceId.Trim();
    }

    private static string? NormalizeNote(string? note)
    {
        return string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    private static string ResolveAuditAction(string entryType)
    {
        return entryType switch
        {
            CustomerCurrentAccountEntryTypes.SaleCharge => CustomerCurrentAccountEventTypes.CustomerAccountCharged,
            CustomerCurrentAccountEntryTypes.Collection => CustomerCurrentAccountEventTypes.CustomerCollectionRecorded,
            _ => CustomerCurrentAccountEventTypes.CustomerAccountAdjusted
        };
    }

    private static bool IsUniqueViolation(DbUpdateException ex)
    {
        return ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
    }
}
