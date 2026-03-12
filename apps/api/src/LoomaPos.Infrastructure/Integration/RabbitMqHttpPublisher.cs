using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace LoomaPos.Infrastructure.Integration;

public sealed class RabbitMqHttpPublisher : IRabbitMqPublisher
{
    private readonly HttpClient _httpClient;
    private readonly RabbitMqOptions _options;
    private readonly SemaphoreSlim _exchangeLock = new(1, 1);
    private volatile bool _exchangeEnsured;

    public RabbitMqHttpPublisher(
        HttpClient httpClient,
        IOptions<RabbitMqOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    public async Task PublishAsync(string routingKey, object payload, CancellationToken cancellationToken)
    {
        if (!_options.Enabled)
        {
            return;
        }

        var payloadText = payload is string rawPayload
            ? rawPayload
            : JsonSerializer.Serialize(payload);

        await EnsureExchangeAsync(cancellationToken);

        var url = BuildPublishUrl();
        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(new
            {
                properties = new { },
                routing_key = routingKey,
                payload = payloadText,
                payload_encoding = "string"
            })
        };
        request.Headers.Authorization = BuildAuthorizationHeader(_options.Username, _options.Password);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                $"RabbitMQ publish failed with {(int)response.StatusCode}: {body}");
        }
    }

    private async Task EnsureExchangeAsync(CancellationToken cancellationToken)
    {
        if (_exchangeEnsured)
        {
            return;
        }

        await _exchangeLock.WaitAsync(cancellationToken);
        try
        {
            if (_exchangeEnsured)
            {
                return;
            }

            var baseUrl = _options.ManagementBaseUrl.TrimEnd('/');
            var escapedVhost = Uri.EscapeDataString(_options.VHost);
            var escapedExchange = Uri.EscapeDataString(_options.Exchange);
            var ensureUrl = $"{baseUrl}/api/exchanges/{escapedVhost}/{escapedExchange}";

            using var request = new HttpRequestMessage(HttpMethod.Put, ensureUrl)
            {
                Content = JsonContent.Create(new
                {
                    type = "topic",
                    durable = true,
                    auto_delete = false,
                    @internal = false
                })
            };
            request.Headers.Authorization = BuildAuthorizationHeader(_options.Username, _options.Password);

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                throw new InvalidOperationException(
                    $"RabbitMQ exchange ensure failed with {(int)response.StatusCode}: {body}");
            }

            _exchangeEnsured = true;
        }
        finally
        {
            _exchangeLock.Release();
        }
    }

    private string BuildPublishUrl()
    {
        var baseUrl = _options.ManagementBaseUrl.TrimEnd('/');
        var escapedVhost = Uri.EscapeDataString(_options.VHost);
        var escapedExchange = Uri.EscapeDataString(_options.Exchange);
        return $"{baseUrl}/api/exchanges/{escapedVhost}/{escapedExchange}/publish";
    }

    private static AuthenticationHeaderValue BuildAuthorizationHeader(string username, string password)
    {
        var token = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{username}:{password}"));
        return new AuthenticationHeaderValue("Basic", token);
    }
}
