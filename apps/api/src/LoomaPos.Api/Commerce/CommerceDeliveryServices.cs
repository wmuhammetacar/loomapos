using System.Text;
using LoomaPos.Domain.Commerce;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Commerce;

public interface IInvoicePdfService
{
    byte[] BuildInvoicePdf(
        string companyName,
        Invoice invoice,
        IReadOnlyList<InvoiceLine> lines,
        string? billingEmail,
        string? addressLine,
        string? city);
}

public sealed class InvoicePdfService : IInvoicePdfService
{
    public byte[] BuildInvoicePdf(
        string companyName,
        Invoice invoice,
        IReadOnlyList<InvoiceLine> lines,
        string? billingEmail,
        string? addressLine,
        string? city)
    {
        var contentLines = new List<string>
        {
            "LoomaPOS Commercial Invoice",
            $"Company: {Normalize(companyName)}",
            $"Invoice No: {Normalize(invoice.InvoiceNo)}",
            $"Issued At: {invoice.IssuedAt:yyyy-MM-dd HH:mm}",
            $"Status: {Normalize(invoice.Status)}",
            $"Billing Email: {Normalize(billingEmail)}",
            $"Address: {Normalize(addressLine)}",
            $"City: {Normalize(city)}",
            $"Description: {Normalize(invoice.Description)}",
            $"Subtotal: {invoice.Subtotal:0.00} {Normalize(invoice.Currency)}",
            $"Tax: {invoice.TaxAmount:0.00} {Normalize(invoice.Currency)}",
            $"Total: {invoice.Total:0.00} {Normalize(invoice.Currency)}"
        };

        if (lines.Count > 0)
        {
            contentLines.Add("Invoice Lines:");
            foreach (var line in lines.Take(10))
            {
                contentLines.Add(
                    $"- {Normalize(line.Description)} | Qty {line.Quantity:0.##} | Total {line.TotalAmount:0.00} {Normalize(invoice.Currency)}");
            }
        }

        var streamBuilder = new StringBuilder();
        streamBuilder.AppendLine("BT");
        streamBuilder.AppendLine("/F1 12 Tf");
        streamBuilder.AppendLine("50 790 Td");
        streamBuilder.AppendLine("16 TL");

        foreach (var line in contentLines)
        {
            streamBuilder.AppendLine($"({EscapePdfText(line)}) Tj");
            streamBuilder.AppendLine("T*");
        }

        streamBuilder.AppendLine("ET");
        var stream = streamBuilder.ToString();

        var objects = new[]
        {
            "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
            "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj",
            "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
            "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
            $"5 0 obj << /Length {Encoding.ASCII.GetByteCount(stream)} >> stream\n{stream}endstream\nendobj"
        };

        var builder = new StringBuilder();
        builder.AppendLine("%PDF-1.4");
        var offsets = new List<int> { 0 };

        foreach (var obj in objects)
        {
            offsets.Add(Encoding.ASCII.GetByteCount(builder.ToString()));
            builder.AppendLine(obj);
        }

        var xrefStart = Encoding.ASCII.GetByteCount(builder.ToString());
        builder.AppendLine("xref");
        builder.AppendLine($"0 {objects.Length + 1}");
        builder.AppendLine("0000000000 65535 f ");
        foreach (var offset in offsets.Skip(1))
        {
            builder.AppendLine($"{offset:D10} 00000 n ");
        }

        builder.AppendLine("trailer");
        builder.AppendLine($"<< /Size {objects.Length + 1} /Root 1 0 R >>");
        builder.AppendLine("startxref");
        builder.AppendLine(xrefStart.ToString());
        builder.AppendLine("%%EOF");

        return Encoding.ASCII.GetBytes(builder.ToString());
    }

    private static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "-";
        }

        return new string(value.Trim().Select(ch => ch <= 127 ? ch : '?').ToArray());
    }

    private static string EscapePdfText(string value)
    {
        return value
            .Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("(", "\\(", StringComparison.Ordinal)
            .Replace(")", "\\)", StringComparison.Ordinal);
    }
}

public interface IEmailDispatchService
{
    Task<bool> DispatchAsync(EmailNotification notification, CancellationToken cancellationToken);
}

public sealed class PickupDirectoryEmailDispatchService : IEmailDispatchService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<PickupDirectoryEmailDispatchService> _logger;

    public PickupDirectoryEmailDispatchService(
        IConfiguration configuration,
        ILogger<PickupDirectoryEmailDispatchService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<bool> DispatchAsync(EmailNotification notification, CancellationToken cancellationToken)
    {
        var directory =
            _configuration["Commerce:EmailPickupDirectory"] ??
            Path.Combine(AppContext.BaseDirectory, "email-pickup");
        Directory.CreateDirectory(directory);

        var fileName =
            $"{DateTimeOffset.UtcNow:yyyyMMddHHmmss}_{notification.EventCode}_{notification.Id:N}.md";
        var filePath = Path.Combine(directory, fileName);
        var payload = $$"""
        To: {{notification.ToEmail}}
        Subject: {{notification.Subject}}
        Event: {{notification.EventCode}}
        CreatedAt: {{notification.CreatedAt:O}}

        {{notification.BodyMarkdown}}
        """;

        await File.WriteAllTextAsync(filePath, payload, cancellationToken);
        _logger.LogInformation("Commercial email written to pickup directory: {EmailFile}", filePath);
        return true;
    }
}

public sealed class EmailDispatchBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EmailDispatchBackgroundService> _logger;

    public EmailDispatchBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<EmailDispatchBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessQueueAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Commercial email dispatch cycle failed.");
            }

            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }

    private async Task ProcessQueueAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var dispatchService = scope.ServiceProvider.GetRequiredService<IEmailDispatchService>();

        var queuedNotifications = await dbContext.EmailNotifications
            .Where(x => x.Status == "queued")
            .OrderBy(x => x.CreatedAt)
            .Take(20)
            .ToListAsync(cancellationToken);
        if (queuedNotifications.Count == 0)
        {
            return;
        }

        foreach (var notification in queuedNotifications)
        {
            try
            {
                var sent = await dispatchService.DispatchAsync(notification, cancellationToken);
                notification.Status = sent ? "sent" : "failed";
                notification.SentAt = sent ? DateTimeOffset.UtcNow : notification.SentAt;
            }
            catch (Exception ex)
            {
                notification.Status = "failed";
                _logger.LogWarning(ex, "Commercial email dispatch failed for notification {EmailNotificationId}.", notification.Id);
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
