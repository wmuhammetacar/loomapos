export interface PublicApiMetaResponse {
  version: string;
  generatedAt: string;
  authentication: {
    header: string;
    oneTimeReveal: boolean;
  };
  docs: {
    openApiJson: string;
    swaggerUi: string;
    quickStart: string;
    postmanCollection: string;
    typescriptSdk: string;
  };
  scopes: string[];
  endpoints: Array<{ method: string; path: string; scope: string }>;
}

export interface PublicProduct {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  salePrice: number;
  stockQty: number;
}

export interface PublicProductsResponse {
  items: PublicProduct[];
  count: number;
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
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async meta(): Promise<PublicApiMetaResponse> {
    return await this.request<PublicApiMetaResponse>("/public/v1/meta", false);
  }

  async products(): Promise<PublicProductsResponse> {
    return await this.request<PublicProductsResponse>("/public/v1/products", true);
  }

  async analyticsSummary(): Promise<PublicAnalyticsSummary> {
    return await this.request<PublicAnalyticsSummary>("/public/v1/analytics/summary", true);
  }

  private async request<T>(path: string, requiresKey: boolean): Promise<T> {
    const headers: HeadersInit = {};
    if (requiresKey) {
      headers["X-Api-Key"] = this.apiKey;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "GET",
      headers
    });

    if (!response.ok) {
      throw new Error(`Public API request failed (${response.status}) for ${path}`);
    }

    return (await response.json()) as T;
  }
}
