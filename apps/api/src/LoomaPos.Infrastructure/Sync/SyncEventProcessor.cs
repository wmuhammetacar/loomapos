using System.Text.Json;
using System.Text.Json.Serialization;
using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Catalog;
using LoomaPos.Domain.Inventory;
using LoomaPos.Domain.Sales;
using LoomaPos.Domain.Sync;
using LoomaPos.Infrastructure.Integration;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LoomaPos.Infrastructure.Sync;

public sealed class SyncEventProcessor : ISyncEventProcessor
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters =
        {
            new JsonStringEnumConverter()
        }
    };

    private readonly AppDbContext _dbContext;
    private readonly IRabbitMqPublisher _rabbitMqPublisher;
    private readonly ILogger<SyncEventProcessor> _logger;

    public SyncEventProcessor(
        AppDbContext dbContext,
        IRabbitMqPublisher rabbitMqPublisher,
        ILogger<SyncEventProcessor> logger)
    {
        _dbContext = dbContext;
        _rabbitMqPublisher = rabbitMqPublisher;
        _logger = logger;
    }

    public async Task<SyncEventResult> ProcessAsync(SyncEventRequest request, CancellationToken cancellationToken)
    {
        if (await _dbContext.ProcessedEvents.AnyAsync(x => x.EventId == request.EventId, cancellationToken))
        {
            return new SyncEventResult("duplicate", true, "Event already processed.", null, request.EventId.ToString());
        }

        var validationFailure = await ValidateOperationalStateAsync(request, cancellationToken);
        if (validationFailure is not null)
        {
            return validationFailure;
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        if (await _dbContext.ProcessedEvents.AnyAsync(x => x.EventId == request.EventId, cancellationToken))
        {
            return new SyncEventResult("duplicate", true, "Event already processed.", null, request.EventId.ToString());
        }

        await TouchDeviceAsync(request, cancellationToken);

        switch (request.EventType.ToUpperInvariant())
        {
            case SyncEventTypes.SaleCreated:
                await ProcessSaleCreatedAsync(request, cancellationToken);
                break;

            case SyncEventTypes.SaleVoided:
                await ProcessSaleVoidedAsync(request, cancellationToken);
                break;

            case SyncEventTypes.SaleRefundCreated:
                await ProcessSaleRefundCreatedAsync(request, cancellationToken);
                break;

            case SyncEventTypes.StockAdjusted:
                await ProcessStockAdjustedAsync(request, cancellationToken);
                break;

            case SyncEventTypes.PaymentAdded:
                await ProcessPaymentAddedAsync(request, cancellationToken);
                break;

            case SyncEventTypes.CashSessionOpened:
                AddDomainAuditLog(request, "CASH_SESSION_OPENED", "cash_sessions", request.AggregateId ?? request.EventId.ToString(), request.Payload);
                break;

            case SyncEventTypes.CashSessionClosed:
                AddDomainAuditLog(request, "CASH_SESSION_CLOSED", "cash_sessions", request.AggregateId ?? request.EventId.ToString(), request.Payload);
                break;

            case SyncEventTypes.CashAdjustmentRecorded:
                await ProcessCashAdjustmentRecordedAsync(request, cancellationToken);
                break;

            case SyncEventTypes.DeviceHeartbeat:
                AddDomainAuditLog(request, "DEVICE_HEARTBEAT", "devices", request.DeviceId.ToString(), request.Payload);
                break;

            case SyncEventTypes.UserSessionStarted:
                AddDomainAuditLog(request, "USER_SESSION_STARTED", "user_sessions", request.AggregateId ?? request.EventId.ToString(), request.Payload);
                break;

            case SyncEventTypes.UserSessionEnded:
                AddDomainAuditLog(request, "USER_SESSION_ENDED", "user_sessions", request.AggregateId ?? request.EventId.ToString(), request.Payload);
                break;

            case SyncEventTypes.StockCountSubmitted:
                await ProcessStockCountSubmittedAsync(request, cancellationToken);
                break;

            case SyncEventTypes.ProductCreated:
                {
                    var result = await ProcessMobileProductMutationAsync(request, cancellationToken);
                    if (result is not null)
                    {
                        return result;
                    }
                    break;
                }

            case SyncEventTypes.ProductUpdated:
                {
                    var result = await ProcessMobileProductMutationAsync(request, cancellationToken);
                    if (result is not null)
                    {
                        return result;
                    }
                    break;
                }

            case SyncEventTypes.MobileDeviceHeartbeat:
                AddDomainAuditLog(request, "MOBILE_DEVICE_HEARTBEAT", "devices", request.DeviceId.ToString(), request.Payload);
                break;

            case SyncEventTypes.MobileSessionStarted:
                AddDomainAuditLog(request, "MOBILE_SESSION_STARTED", "mobile_sessions", request.AggregateId ?? request.EventId.ToString(), request.Payload);
                break;

            case SyncEventTypes.MobileSessionEnded:
                AddDomainAuditLog(request, "MOBILE_SESSION_ENDED", "mobile_sessions", request.AggregateId ?? request.EventId.ToString(), request.Payload);
                break;

            default:
                return new SyncEventResult("rejected", false, $"Unsupported event type: {request.EventType}", "unsupported_event_type");
        }

        _dbContext.ProcessedEvents.Add(new ProcessedEvent
        {
            EventId = request.EventId,
            TenantId = request.TenantId,
            DeviceId = request.DeviceId,
            ProcessedAt = DateTimeOffset.UtcNow
        });

        _dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = request.TenantId,
            Action = "SYNC_EVENT_PROCESSED",
            Entity = "processed_events",
            EntityId = request.EventId.ToString(),
            PayloadJson = request.Payload.GetRawText()
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await PublishIntegrationEventAsync(request, cancellationToken);

        return new SyncEventResult("accepted", false, "Event processed.", null, request.AggregateId ?? request.EventId.ToString());
    }

    public async Task<IReadOnlyList<SyncEventResult>> ProcessBatchAsync(
        IEnumerable<SyncEventRequest> requests,
        CancellationToken cancellationToken)
    {
        var results = new List<SyncEventResult>();
        foreach (var request in requests)
        {
            try
            {
                results.Add(await ProcessAsync(request, cancellationToken));
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Sync event {EventId} rejected: {Message}", request.EventId, ex.Message);
                results.Add(new SyncEventResult("rejected", false, ex.Message, "validation_error", request.AggregateId ?? request.EventId.ToString()));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Sync event {EventId} failed and should be retried.", request.EventId);
                results.Add(new SyncEventResult("retry_later", false, "Temporary sync failure.", "server_error", request.AggregateId ?? request.EventId.ToString()));
            }
        }

        return results;
    }

    private async Task PublishIntegrationEventAsync(SyncEventRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var routingKey = $"sync.{request.EventType.ToLowerInvariant()}";
            await _rabbitMqPublisher.PublishAsync(routingKey, new
            {
                request.EventId,
                request.TenantId,
                request.BranchId,
                request.DeviceId,
                request.EventType,
                Payload = request.Payload.GetRawText(),
                PublishedAt = DateTimeOffset.UtcNow
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "RabbitMQ publish failed for sync event {EventId}. Processing already committed.",
                request.EventId);
        }
    }

    private async Task ProcessSaleCreatedAsync(SyncEventRequest request, CancellationToken cancellationToken)
    {
        var payload = DeserializePayload<SaleCreatedPayload>(request.Payload);

        var existingSale = await _dbContext.Sales
            .AnyAsync(x => x.Id == payload.SaleId, cancellationToken);
        if (existingSale)
        {
            return;
        }

        var sale = new Sale
        {
            Id = payload.SaleId,
            TenantId = request.TenantId,
            BranchId = request.BranchId,
            DeviceId = request.DeviceId,
            ReceiptNo = payload.ReceiptNo,
            Subtotal = payload.Subtotal,
            Discount = payload.Discount,
            Tax = payload.Tax,
            Total = payload.Total,
            CreatedAt = payload.CreatedAt
        };

        foreach (var line in payload.Lines)
        {
            sale.Lines.Add(new SaleLine
            {
                ProductId = line.ProductId,
                Qty = line.Qty,
                UnitPrice = line.UnitPrice,
                Discount = line.Discount,
                Tax = line.Tax,
                LineTotal = line.LineTotal
            });

            if (!await IsStockTrackingEnabledAsync(line.ProductId, cancellationToken))
            {
                continue;
            }

            _dbContext.StockMoves.Add(new StockMove
            {
                TenantId = request.TenantId,
                BranchId = request.BranchId,
                ProductId = line.ProductId,
                QtyDelta = -line.Qty,
                Reason = "SALE_CREATED",
                RefType = "sale",
                RefId = payload.SaleId.ToString()
            });

            await UpsertStockBalanceAsync(request.TenantId, request.BranchId, line.ProductId, -line.Qty, cancellationToken);
        }

        foreach (var payment in payload.Payments)
        {
            sale.Payments.Add(new Payment
            {
                Method = payment.Method,
                Amount = payment.Amount
            });
        }

        _dbContext.Sales.Add(sale);
        AddDomainAuditLog(request, "SALE_CREATED", "sales", payload.SaleId.ToString(), payload);
    }

    private async Task ProcessSaleVoidedAsync(SyncEventRequest request, CancellationToken cancellationToken)
    {
        var payload = DeserializePayload<SaleVoidedPayload>(request.Payload);

        var sale = await _dbContext.Sales
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == payload.SaleId, cancellationToken);

        if (sale is null || sale.Status == Domain.Common.SaleStatus.Voided)
        {
            return;
        }

        sale.Status = Domain.Common.SaleStatus.Voided;

        foreach (var line in sale.Lines)
        {
            if (!await IsStockTrackingEnabledAsync(line.ProductId, cancellationToken))
            {
                continue;
            }

            _dbContext.StockMoves.Add(new StockMove
            {
                TenantId = request.TenantId,
                BranchId = request.BranchId,
                ProductId = line.ProductId,
                QtyDelta = line.Qty,
                Reason = payload.Reason ?? "SALE_VOIDED",
                RefType = "sale_void",
                RefId = payload.SaleId.ToString()
            });

            await UpsertStockBalanceAsync(request.TenantId, request.BranchId, line.ProductId, line.Qty, cancellationToken);
        }

        AddDomainAuditLog(request, "SALE_VOIDED", "sales", payload.SaleId.ToString(), payload);
    }

    private async Task ProcessSaleRefundCreatedAsync(SyncEventRequest request, CancellationToken cancellationToken)
    {
        var payload = DeserializePayload<SaleRefundCreatedPayload>(request.Payload);

        var existingSale = await _dbContext.Sales
            .AnyAsync(x => x.Id == payload.RefundSaleId, cancellationToken);
        if (existingSale)
        {
            return;
        }

        var sale = new Sale
        {
            Id = payload.RefundSaleId,
            TenantId = request.TenantId,
            BranchId = request.BranchId,
            DeviceId = request.DeviceId,
            ReceiptNo = payload.ReceiptNo,
            Status = Domain.Common.SaleStatus.Refunded,
            Subtotal = payload.Subtotal,
            Discount = payload.Discount,
            Tax = payload.Tax,
            Total = payload.Total,
            CreatedAt = payload.CreatedAt
        };

        foreach (var line in payload.Lines)
        {
            sale.Lines.Add(new SaleLine
            {
                ProductId = line.ProductId,
                Qty = line.Qty,
                UnitPrice = line.UnitPrice,
                Discount = line.Discount,
                Tax = line.Tax,
                LineTotal = line.LineTotal
            });

            if (!await IsStockTrackingEnabledAsync(line.ProductId, cancellationToken))
            {
                continue;
            }

            _dbContext.StockMoves.Add(new StockMove
            {
                TenantId = request.TenantId,
                BranchId = request.BranchId,
                ProductId = line.ProductId,
                QtyDelta = line.Qty,
                Reason = SyncEventTypes.SaleRefundCreated,
                RefType = "sale_refund",
                RefId = payload.RefundSaleId.ToString()
            });

            await UpsertStockBalanceAsync(request.TenantId, request.BranchId, line.ProductId, line.Qty, cancellationToken);
        }

        foreach (var payment in payload.Payments)
        {
            sale.Payments.Add(new Payment
            {
                Method = payment.Method,
                Amount = payment.Amount
            });
        }

        _dbContext.Sales.Add(sale);
        AddDomainAuditLog(request, "SALE_REFUND_CREATED", "sales", payload.RefundSaleId.ToString(), payload);
    }

    private async Task ProcessStockAdjustedAsync(SyncEventRequest request, CancellationToken cancellationToken)
    {
        var payload = DeserializePayload<StockAdjustedPayload>(request.Payload);

        _dbContext.StockMoves.Add(new StockMove
        {
            TenantId = request.TenantId,
            BranchId = request.BranchId,
            ProductId = payload.ProductId,
            QtyDelta = payload.QtyDelta,
            Reason = payload.ReasonCode ?? payload.Reason ?? SyncEventTypes.StockAdjusted,
            RefType = "manual_adjustment",
            RefId = request.EventId.ToString()
        });

        await UpsertStockBalanceAsync(request.TenantId, request.BranchId, payload.ProductId, payload.QtyDelta, cancellationToken);
        AddDomainAuditLog(request, "STOCK_ADJUSTED", "stock_moves", request.EventId.ToString(), payload);
    }

    private async Task ProcessPaymentAddedAsync(SyncEventRequest request, CancellationToken cancellationToken)
    {
        var payload = DeserializePayload<PaymentAddedPayload>(request.Payload);

        var saleExists = await _dbContext.Sales
            .AnyAsync(x => x.Id == payload.SaleId, cancellationToken);
        if (!saleExists)
        {
            return;
        }

        var paymentExists = await _dbContext.Payments
            .AnyAsync(x => x.SaleId == payload.SaleId && x.Method == payload.Method && x.Amount == payload.Amount, cancellationToken);
        if (paymentExists)
        {
            return;
        }

        _dbContext.Payments.Add(new Payment
        {
            SaleId = payload.SaleId,
            Method = payload.Method,
            Amount = payload.Amount
        });

        AddDomainAuditLog(request, "SALE_PAYMENT_RECORDED", "payments", payload.SaleId.ToString(), payload);
    }

    private async Task ProcessCashAdjustmentRecordedAsync(SyncEventRequest request, CancellationToken cancellationToken)
    {
        var payload = DeserializePayload<CashAdjustmentRecordedPayload>(request.Payload);
        _dbContext.CashTransactions.Add(new Domain.Cashbook.CashTransaction
        {
            TenantId = request.TenantId,
            BranchId = request.BranchId,
            Type = payload.Type.Equals("cash_out", StringComparison.OrdinalIgnoreCase)
                ? Domain.Common.CashTransactionType.Out
                : Domain.Common.CashTransactionType.In,
            Amount = payload.Amount,
            Reason = payload.Reason
        });

        AddDomainAuditLog(request, "CASH_ADJUSTMENT_RECORDED", "cash_transactions", request.AggregateId ?? request.EventId.ToString(), payload);
        await Task.CompletedTask;
    }

    private async Task ProcessStockCountSubmittedAsync(SyncEventRequest request, CancellationToken cancellationToken)
    {
        var payload = DeserializePayload<StockCountSubmittedPayload>(request.Payload);
        AddDomainAuditLog(request, "STOCK_COUNT_SUBMITTED", "stock_count_sessions", payload.StockCountSessionId.ToString(), payload);
        await Task.CompletedTask;
        cancellationToken.ThrowIfCancellationRequested();
    }

    private async Task<SyncEventResult?> ProcessMobileProductMutationAsync(
        SyncEventRequest request,
        CancellationToken cancellationToken)
    {
        var payload = DeserializePayload<MobileProductMutationPayload>(request.Payload);
        var normalizedBarcode = string.IsNullOrWhiteSpace(payload.Barcode)
            ? null
            : payload.Barcode.Trim();

        if (!string.IsNullOrWhiteSpace(normalizedBarcode))
        {
            var duplicateBarcode = await _dbContext.Products.AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.TenantId == request.TenantId &&
                        x.Barcode == normalizedBarcode &&
                        x.Id != (payload.ProductId ?? Guid.Empty),
                    cancellationToken);
            if (duplicateBarcode is not null)
            {
                return new SyncEventResult(
                    "conflict",
                    false,
                    $"Barcode already exists on product {duplicateBarcode.Name}.",
                    "barcode_conflict",
                    duplicateBarcode.Id.ToString());
            }
        }

        Guid? categoryId = null;
        if (!string.IsNullOrWhiteSpace(payload.CategoryName))
        {
            var normalizedCategoryName = payload.CategoryName.Trim();
            var category = await _dbContext.Categories
                .FirstOrDefaultAsync(
                    x => x.TenantId == request.TenantId && x.Name == normalizedCategoryName,
                    cancellationToken);
            if (category is null)
            {
                category = new Category
                {
                    TenantId = request.TenantId,
                    Name = normalizedCategoryName
                };
                _dbContext.Categories.Add(category);
            }
            categoryId = category.Id;
        }

        var productId = payload.ProductId ?? ParseAggregateGuid(request.AggregateId) ?? Guid.NewGuid();
        var product = await _dbContext.Products
            .FirstOrDefaultAsync(x => x.Id == productId && x.TenantId == request.TenantId, cancellationToken);

        if (product is null)
        {
            product = new Product
            {
                Id = productId,
                TenantId = request.TenantId
            };
            _dbContext.Products.Add(product);
        }

        product.CategoryId = categoryId;
        product.Name = payload.Name.Trim();
        product.Barcode = normalizedBarcode;
        product.Sku = string.IsNullOrWhiteSpace(payload.Sku) ? null : payload.Sku.Trim();
        product.SalePrice = payload.SalePrice;
        product.PurchasePrice = payload.PurchasePrice;
        product.TaxRate = payload.TaxRate;
        product.StockTrackingEnabled = payload.StockTracked;
        product.MinStock = payload.MinStock;
        product.IsActive = payload.IsActive;

        var branchId = payload.BranchId ?? request.BranchId;
        var stockBalance = await _dbContext.StockBalances
            .FirstOrDefaultAsync(
                x => x.TenantId == request.TenantId &&
                    x.BranchId == branchId &&
                    x.ProductId == productId,
                cancellationToken);
        if (stockBalance is null)
        {
            _dbContext.StockBalances.Add(new StockBalance
            {
                TenantId = request.TenantId,
                BranchId = branchId,
                ProductId = productId,
                Qty = payload.StockQty
            });
        }
        else
        {
            stockBalance.Qty = payload.StockQty;
        }

        AddDomainAuditLog(
            request,
            request.EventType.Equals(SyncEventTypes.ProductCreated, StringComparison.OrdinalIgnoreCase)
                ? "PRODUCT_CREATED"
                : "PRODUCT_UPDATED",
            "products",
            productId.ToString(),
            payload);
        return null;
    }

    private async Task TouchDeviceAsync(SyncEventRequest request, CancellationToken cancellationToken)
    {
        var isMobileEvent = request.EventType.StartsWith("MOBILE_", StringComparison.OrdinalIgnoreCase);
        var existingDevice = await _dbContext.Devices
            .FirstOrDefaultAsync(x => x.Id == request.DeviceId, cancellationToken);

        if (existingDevice is null)
        {
            _dbContext.Devices.Add(new Device
            {
                Id = request.DeviceId,
                TenantId = request.TenantId,
                BranchId = request.BranchId,
                Name = isMobileEvent
                    ? $"MOB-{request.DeviceId.ToString()[..8]}"
                    : $"POS-{request.DeviceId.ToString()[..8]}",
                Type = isMobileEvent ? "mobile-ops" : "desktop-pos",
                LastSeenAt = DateTimeOffset.UtcNow
            });

            return;
        }

        existingDevice.LastSeenAt = DateTimeOffset.UtcNow;
        existingDevice.BranchId = request.BranchId;
        if (isMobileEvent)
        {
            existingDevice.Type = "mobile-ops";
        }
    }

    private async Task<SyncEventResult?> ValidateOperationalStateAsync(
        SyncEventRequest request,
        CancellationToken cancellationToken)
    {
        var activation = await _dbContext.DeviceActivations.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == request.TenantId && x.DeviceId == request.DeviceId, cancellationToken);
        if (activation is not null && (activation.RevokedAt != null || activation.Status.Equals("revoked", StringComparison.OrdinalIgnoreCase)))
        {
            return new SyncEventResult("device_invalid", false, "Device activation is revoked.", "device_revoked", request.DeviceId.ToString());
        }

        var license = await _dbContext.IssuedLicenses.AsNoTracking()
            .Where(x => x.TenantId == request.TenantId)
            .OrderByDescending(x => x.IssuedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (license is not null && !license.Status.Equals("active", StringComparison.OrdinalIgnoreCase))
        {
            return new SyncEventResult("license_invalid", false, "Tenant license is not active.", "license_invalid", license.Id.ToString());
        }

        return null;
    }

    private async Task UpsertStockBalanceAsync(
        Guid tenantId,
        Guid branchId,
        Guid productId,
        decimal qtyDelta,
        CancellationToken cancellationToken)
    {
        var stockBalance = await _dbContext.StockBalances.FirstOrDefaultAsync(
            x => x.TenantId == tenantId && x.BranchId == branchId && x.ProductId == productId,
            cancellationToken);

        if (stockBalance is null)
        {
            _dbContext.StockBalances.Add(new StockBalance
            {
                TenantId = tenantId,
                BranchId = branchId,
                ProductId = productId,
                Qty = qtyDelta
            });
            return;
        }

        stockBalance.Qty += qtyDelta;
    }

    private static TPayload DeserializePayload<TPayload>(JsonElement payload)
    {
        var value = JsonSerializer.Deserialize<TPayload>(payload.GetRawText(), JsonOptions);
        return value ?? throw new InvalidOperationException($"Payload parsing failed for type {typeof(TPayload).Name}.");
    }

    private static Guid? ParseAggregateGuid(string? value)
    {
        return Guid.TryParse(value, out var parsed) ? parsed : null;
    }

    private async Task<bool> IsStockTrackingEnabledAsync(Guid productId, CancellationToken cancellationToken)
    {
        var product = await _dbContext.Products.AsNoTracking()
            .Select(x => new { x.Id, x.StockTrackingEnabled })
            .FirstOrDefaultAsync(x => x.Id == productId, cancellationToken);

        return product?.StockTrackingEnabled ?? true;
    }

    private void AddDomainAuditLog(
        SyncEventRequest request,
        string action,
        string entity,
        string entityId,
        object payload)
    {
        _dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = request.TenantId,
            Action = action,
            Entity = entity,
            EntityId = entityId,
            PayloadJson = JsonSerializer.Serialize(payload)
        });
    }
}
