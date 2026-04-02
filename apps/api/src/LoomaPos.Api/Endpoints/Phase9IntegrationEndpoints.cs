using System.Text;
using LoomaPos.Api.Commerce;
using LoomaPos.Api.Integrations;
using LoomaPos.Api.Security;
using LoomaPos.Domain.Common;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class Phase9IntegrationEndpoints
{
    public static IEndpointRouteBuilder MapPhase9IntegrationEndpoints(this IEndpointRouteBuilder app)
    {
        var portal = app.MapGroup("/commerce/portal/integrations").WithTags("Portal Integrations");
        portal.MapGet(string.Empty, GetPortalWorkspaceAsync);
        portal.MapPost("/connections", CreateConnectionAsync);
        portal.MapPatch("/connections/{connectionId:guid}", UpdateConnectionAsync);
        portal.MapPost("/connections/{connectionId:guid}/validate", ValidateConnectionAsync);
        portal.MapPost("/connections/{connectionId:guid}/toggle", ToggleConnectionAsync);
        portal.MapPost("/connections/{connectionId:guid}/mapping-preview", PreviewConnectionMappingAsync);
        portal.MapPost("/webhooks", CreateWebhookAsync);
        portal.MapPost("/webhooks/{endpointId:guid}/rotate-secret", RotateWebhookSecretAsync);
        portal.MapPost("/webhooks/{endpointId:guid}/test", TestWebhookAsync);
        portal.MapPost("/api-clients", CreateApiClientAsync);
        portal.MapPost("/api-keys/{apiKeyId:guid}/revoke", RevokeApiKeyAsync);

        var admin = app.MapGroup("/internal/admin/integrations").WithTags("Internal Integrations").RequireInternalAdminAccess();
        admin.MapGet(string.Empty, GetAdminWorkspaceAsync);
        admin.MapPost("/jobs/{jobId:guid}/retry", RetryJobAsync);
        admin.MapPost("/dead-letter/replay", ReplayDeadLettersAsync);

        app.MapPost("/integrations/webhooks/inbound/{providerCode}", InboundWebhookAsync)
            .WithTags("Inbound Webhooks");

        var publicApi = app.MapGroup("/public/v1").WithTags("Public API v1");
        publicApi.MapGet("/meta", GetPublicApiMetaAsync);
        publicApi.MapGet("/docs/postman", GetPublicApiPostmanCollectionAsync);
        publicApi.MapGet("/docs/sdk/typescript", GetPublicApiTypeScriptSdkAsync);
        publicApi.MapGet("/products", GetPublicProductsAsync);
        publicApi.MapGet("/analytics/summary", GetPublicAnalyticsSummaryAsync);

        return app;
    }

    private static async Task<IResult> GetPortalWorkspaceAsync(HttpContext httpContext, IPortalAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        var access = await RequirePortalAccessAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }

        var workspace = await integrationService.GetTenantWorkspaceAsync(access.TenantId.Value, cancellationToken);
        return Results.Ok(workspace);
    }

    private static async Task<IResult> CreateConnectionAsync(SaveIntegrationConnectionRequest request, HttpContext httpContext, IPortalAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        var access = await RequirePortalAccessAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }
        if (!HasPortalRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var result = await integrationService.SaveConnectionAsync(access.TenantId.Value, request, access.Email, cancellationToken);
        return Results.Ok(result);
    }

    private static async Task<IResult> UpdateConnectionAsync(Guid connectionId, UpdateIntegrationConnectionRequest request, HttpContext httpContext, IPortalAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        var access = await RequirePortalAccessAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }
        if (!HasPortalRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var result = await integrationService.UpdateConnectionAsync(access.TenantId.Value, connectionId, request, access.Email, cancellationToken);
        return Results.Ok(result);
    }

    private static async Task<IResult> ValidateConnectionAsync(Guid connectionId, HttpContext httpContext, IPortalAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        var access = await RequirePortalAccessAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }
        if (!HasPortalRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var result = await integrationService.ValidateConnectionAsync(access.TenantId.Value, connectionId, access.Email, cancellationToken);
        return Results.Ok(result);
    }

    private static async Task<IResult> ToggleConnectionAsync(Guid connectionId, ToggleRequest request, HttpContext httpContext, IPortalAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        var access = await RequirePortalAccessAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }
        if (!HasPortalRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var result = await integrationService.ToggleConnectionAsync(access.TenantId.Value, connectionId, request.Enabled, access.Email, cancellationToken);
        return Results.Ok(result);
    }

    private static async Task<IResult> PreviewConnectionMappingAsync(Guid connectionId, IntegrationMappingPreviewRequest request, HttpContext httpContext, IPortalAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        var access = await RequirePortalAccessAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }
        if (!HasPortalRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var preview = await integrationService.PreviewMappingAsync(access.TenantId.Value, connectionId, request, cancellationToken);
        return Results.Ok(preview);
    }

    private static async Task<IResult> CreateWebhookAsync(CreateWebhookEndpointRequest request, HttpContext httpContext, IPortalAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        var access = await RequirePortalAccessAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }
        if (!HasPortalRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var result = await integrationService.CreateWebhookEndpointAsync(access.TenantId.Value, request, access.Email, cancellationToken);
        return Results.Ok(result);
    }

    private static async Task<IResult> RotateWebhookSecretAsync(Guid endpointId, HttpContext httpContext, IPortalAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        var access = await RequirePortalAccessAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }
        if (!HasPortalRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var result = await integrationService.RotateWebhookSecretAsync(access.TenantId.Value, endpointId, access.Email, cancellationToken);
        return Results.Ok(result);
    }

    private static async Task<IResult> TestWebhookAsync(Guid endpointId, HttpContext httpContext, IPortalAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        var access = await RequirePortalAccessAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }
        if (!HasPortalRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var result = await integrationService.TestWebhookAsync(access.TenantId.Value, endpointId, access.Email, cancellationToken);
        return Results.Ok(result);
    }

    private static async Task<IResult> CreateApiClientAsync(CreateApiClientRequest request, HttpContext httpContext, IPortalAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        var access = await RequirePortalAccessAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }
        if (!HasPortalRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var created = await integrationService.CreateApiClientAsync(access.TenantId.Value, request, access.Email, cancellationToken);
        return Results.Ok(new
        {
            client = created.Client,
            plaintextKey = created.PlaintextKey
        });
    }

    private static async Task<IResult> RevokeApiKeyAsync(Guid apiKeyId, HttpContext httpContext, IPortalAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        var access = await RequirePortalAccessAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }
        if (!HasPortalRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        return await integrationService.RevokeApiKeyAsync(access.TenantId.Value, apiKeyId, access.Email, cancellationToken)
            ? Results.Ok(new { revoked = true, apiKeyId })
            : Results.NotFound();
    }

    private static async Task<IResult> GetAdminWorkspaceAsync(HttpContext httpContext, IInternalAdminAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        return Results.Ok(await integrationService.GetAdminWorkspaceAsync(cancellationToken));
    }

    private static async Task<IResult> RetryJobAsync(Guid jobId, AdminReasonRequest request, HttpContext httpContext, IInternalAdminAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null)
        {
            return Results.Unauthorized();
        }
        if (!InternalCanIntervene(context.Roles))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "Reason is required." });
        }

        var result = await integrationService.RetryJobAsync(jobId, request.Reason, context.Email, cancellationToken);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> ReplayDeadLettersAsync(ReplayDeadLetterRequest request, HttpContext httpContext, IInternalAdminAuthService authService, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null)
        {
            return Results.Unauthorized();
        }
        if (!InternalCanIntervene(context.Roles))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "Reason is required." });
        }

        var jobs = await integrationService.ReplayDeadLetterJobsAsync(request.TenantId, request.MaxCount ?? 25, request.Reason, context.Email, cancellationToken);
        return Results.Ok(new
        {
            requested = request.MaxCount ?? 25,
            replayed = jobs.Count,
            jobs
        });
    }

    private static async Task<IResult> InboundWebhookAsync(string providerCode, HttpRequest request, IIntegrationPlatformService integrationService, CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(request.Body, Encoding.UTF8);
        var payload = await reader.ReadToEndAsync(cancellationToken);
        var eventKey = request.Headers["X-Event-Key"].ToString();
        if (string.IsNullOrWhiteSpace(eventKey))
        {
            eventKey = Guid.NewGuid().ToString("N");
        }
        var eventType = request.Headers["X-Event-Type"].ToString();
        if (string.IsNullOrWhiteSpace(eventType))
        {
            eventType = "provider.callback";
        }
        var signature = request.Headers["X-Provider-Signature"].ToString();
        if (string.IsNullOrWhiteSpace(signature))
        {
            return Results.BadRequest(new { message = "X-Provider-Signature header is required." });
        }

        var result = await integrationService.RecordInboundWebhookAsync(providerCode, eventKey, eventType, signature, payload, null, cancellationToken);
        if (result.Status is "invalid_signature" or "webhook_secret_missing")
        {
            return Results.BadRequest(result);
        }

        return Results.Ok(result);
    }

    private static async Task<IResult> GetPublicProductsAsync(HttpContext httpContext, IPublicApiAccessService accessService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await accessService.RequireAsync(httpContext, "products:read", cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var products = await (from product in dbContext.Products.AsNoTracking()
                              where product.TenantId == access.TenantId && product.IsActive
                              join balance in dbContext.StockBalances.AsNoTracking() on new { product.TenantId, ProductId = product.Id } equals new { balance.TenantId, balance.ProductId } into balances
                              from balance in balances.DefaultIfEmpty()
                              orderby product.Name
                              select new
                              {
                                  id = product.Id,
                                  name = product.Name,
                                  sku = product.Sku,
                                  barcode = product.Barcode,
                                  salePrice = product.SalePrice,
                                  stockQty = balance == null ? 0 : balance.Qty
                              }).Take(250).ToListAsync(cancellationToken);

        return Results.Ok(new { items = products, count = products.Count });
    }

    private static IResult GetPublicApiMetaAsync(HttpRequest request)
    {
        var root = $"{request.Scheme}://{request.Host}";
        return Results.Ok(new
        {
            version = "v1",
            generatedAt = DateTimeOffset.UtcNow,
            authentication = new
            {
                header = "X-Api-Key",
                oneTimeReveal = true
            },
            docs = new
            {
                openApiJson = $"{root}/swagger/v1/swagger.json",
                swaggerUi = $"{root}/swagger",
                quickStart = $"{root}/public/v1/meta",
                postmanCollection = $"{root}/public/v1/docs/postman",
                typescriptSdk = $"{root}/public/v1/docs/sdk/typescript"
            },
            scopes = new[]
            {
                "products:read",
                "analytics:read"
            },
            endpoints = new[]
            {
                new { method = "GET", path = "/public/v1/products", scope = "products:read" },
                new { method = "GET", path = "/public/v1/analytics/summary", scope = "analytics:read" }
            }
        });
    }

    private static IResult GetPublicApiPostmanCollectionAsync(HttpRequest request)
    {
        var root = $"{request.Scheme}://{request.Host}";
        var collection = new
        {
            info = new
            {
                name = "LoomaPOS Public API v1",
                schema = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
                description = "Public partner API collection for product and analytics read scopes."
            },
            variable = new[]
            {
                new { key = "baseUrl", value = root },
                new { key = "apiKey", value = "replace-with-generated-key" }
            },
            item = new object[]
            {
                new
                {
                    name = "Public API Meta",
                    request = new
                    {
                        method = "GET",
                        header = Array.Empty<object>(),
                        url = new { raw = "{{baseUrl}}/public/v1/meta", host = new[] { "{{baseUrl}}" }, path = new[] { "public", "v1", "meta" } }
                    }
                },
                new
                {
                    name = "List Products",
                    request = new
                    {
                        method = "GET",
                        header = new[] { new { key = "X-Api-Key", value = "{{apiKey}}" } },
                        url = new { raw = "{{baseUrl}}/public/v1/products", host = new[] { "{{baseUrl}}" }, path = new[] { "public", "v1", "products" } }
                    }
                },
                new
                {
                    name = "Analytics Summary",
                    request = new
                    {
                        method = "GET",
                        header = new[] { new { key = "X-Api-Key", value = "{{apiKey}}" } },
                        url = new { raw = "{{baseUrl}}/public/v1/analytics/summary", host = new[] { "{{baseUrl}}" }, path = new[] { "public", "v1", "analytics", "summary" } }
                    }
                }
            }
        };

        return Results.Json(collection);
    }

    private static IResult GetPublicApiTypeScriptSdkAsync(HttpRequest request)
    {
        var root = $"{request.Scheme}://{request.Host}";
        var sdk = $$"""
export interface PublicProduct {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  salePrice: number;
  stockQty: number;
}

export interface PublicAnalyticsSummary {
  periodStart: string;
  grossSales: number;
  transactionCount: number;
  refundAmount: number;
  averageBasket: number;
}

export class LoomaPosPublicApiClient {
  constructor(
    private readonly baseUrl = "{{root}}",
    private readonly apiKey: string
  ) {}

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { "X-Api-Key": this.apiKey }
    });
    if (!response.ok) {
      throw new Error(`Public API request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async products() {
    return await this.get<{ items: PublicProduct[]; count: number }>("/public/v1/products");
  }

  async analyticsSummary() {
    return await this.get<PublicAnalyticsSummary>("/public/v1/analytics/summary");
  }
}
""";

        return Results.Text(sdk, "text/plain");
    }

    private static async Task<IResult> GetPublicAnalyticsSummaryAsync(HttpContext httpContext, IPublicApiAccessService accessService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await accessService.RequireAsync(httpContext, "analytics:read", cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var since = DateTimeOffset.UtcNow.AddDays(-30);
        var sales = await dbContext.Sales.AsNoTracking().Where(x => x.TenantId == access.TenantId && x.CreatedAt >= since).ToListAsync(cancellationToken);
        var refunds = sales.Where(x => x.Status == SaleStatus.Refunded).Sum(x => x.Total);
        return Results.Ok(new
        {
            periodStart = since,
            grossSales = sales.Sum(x => x.Total),
            transactionCount = sales.Count,
            refundAmount = refunds,
            averageBasket = sales.Count == 0 ? 0 : Math.Round(sales.Average(x => x.Total), 2)
        });
    }

    private static async Task<PortalAccessContext?> RequirePortalAccessAsync(HttpContext httpContext, IPortalAuthService authService, CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        return access is { PortalType: "customer" } ? access : null;
    }

    private static bool HasPortalRole(PortalAccessContext access, params string[] roles)
        => roles.Contains(access.RoleCode, StringComparer.OrdinalIgnoreCase);

    private static bool InternalCanIntervene(IEnumerable<string> roles)
        => roles.Any(role => role is "super_admin" or "ops_admin" or "support_agent" or "release_manager");

    private sealed record ToggleRequest(bool Enabled);
}
