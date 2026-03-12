using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace LoomaPos.Infrastructure.Storage;

public sealed class S3CompatibleFileStorage : IFileStorage
{
    private const string Algorithm = "AWS4-HMAC-SHA256";

    private readonly HttpClient _httpClient;
    private readonly FileStorageOptions _options;
    private readonly SemaphoreSlim _bucketLock = new(1, 1);
    private volatile bool _bucketEnsured;

    public S3CompatibleFileStorage(
        HttpClient httpClient,
        IOptions<FileStorageOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    public async Task UploadAsync(string key, Stream content, string contentType, CancellationToken cancellationToken)
    {
        var normalizedKey = NormalizeKey(key);
        await EnsureBucketExistsAsync(cancellationToken);

        await using var buffered = new MemoryStream();
        await content.CopyToAsync(buffered, cancellationToken);
        var body = buffered.ToArray();

        var attempt = 0;
        while (true)
        {
            attempt++;
            var requestTime = DateTimeOffset.UtcNow;
            var requestUri = BuildObjectUri(normalizedKey);
            using var request = new HttpRequestMessage(HttpMethod.Put, requestUri)
            {
                Content = new ByteArrayContent(body)
            };
            request.Content.Headers.ContentType =
                new System.Net.Http.Headers.MediaTypeHeaderValue(string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType);

            ApplySignature(request, body, requestTime);
            using var response = await _httpClient.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return;
            }

            if (response.StatusCode == System.Net.HttpStatusCode.NotFound && attempt == 1)
            {
                _bucketEnsured = false;
                await EnsureBucketExistsAsync(cancellationToken);
                continue;
            }

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"S3 upload failed ({(int)response.StatusCode}): {responseBody}");
        }
    }

    public async Task<StoredFileContent?> OpenReadAsync(string key, CancellationToken cancellationToken)
    {
        var normalizedKey = NormalizeKey(key);
        var requestTime = DateTimeOffset.UtcNow;
        var requestUri = BuildObjectUri(normalizedKey);

        using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
        ApplySignature(request, Array.Empty<byte>(), requestTime);
        var response = await _httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            response.Dispose();
            return null;
        }

        if (!response.IsSuccessStatusCode)
        {
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            response.Dispose();
            throw new InvalidOperationException($"S3 read failed ({(int)response.StatusCode}): {responseBody}");
        }

        var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        var contentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";
        return new StoredFileContent(new ResponseOwnedStream(stream, response), contentType);
    }

    private async Task EnsureBucketExistsAsync(CancellationToken cancellationToken)
    {
        if (_bucketEnsured)
        {
            return;
        }

        await _bucketLock.WaitAsync(cancellationToken);
        try
        {
            if (_bucketEnsured)
            {
                return;
            }

            var requestTime = DateTimeOffset.UtcNow;
            var bucketUri = BuildBucketUri();
            using var headRequest = new HttpRequestMessage(HttpMethod.Head, bucketUri);
            ApplySignature(headRequest, Array.Empty<byte>(), requestTime);
            using var headResponse = await _httpClient.SendAsync(headRequest, cancellationToken);
            if (headResponse.IsSuccessStatusCode)
            {
                _bucketEnsured = true;
                return;
            }

            requestTime = DateTimeOffset.UtcNow;
            using var createRequest = new HttpRequestMessage(HttpMethod.Put, bucketUri)
            {
                Content = new ByteArrayContent(Array.Empty<byte>())
            };
            ApplySignature(createRequest, Array.Empty<byte>(), requestTime);
            using var createResponse = await _httpClient.SendAsync(createRequest, cancellationToken);
            if (!createResponse.IsSuccessStatusCode &&
                createResponse.StatusCode != System.Net.HttpStatusCode.Conflict)
            {
                var responseBody = await createResponse.Content.ReadAsStringAsync(cancellationToken);
                throw new InvalidOperationException(
                    $"S3 bucket ensure failed ({(int)createResponse.StatusCode}): {responseBody}");
            }

            _bucketEnsured = true;
        }
        finally
        {
            _bucketLock.Release();
        }
    }

    private Uri BuildBucketUri()
    {
        return new Uri($"{_options.Endpoint.TrimEnd('/')}/{Uri.EscapeDataString(_options.Bucket)}");
    }

    private Uri BuildObjectUri(string normalizedKey)
    {
        var encodedKey = string.Join('/',
            normalizedKey.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(Uri.EscapeDataString));
        var url = $"{_options.Endpoint.TrimEnd('/')}/{Uri.EscapeDataString(_options.Bucket)}/{encodedKey}";
        return new Uri(url);
    }

    private void ApplySignature(HttpRequestMessage request, byte[] body, DateTimeOffset requestTime)
    {
        var payloadHash = ComputeSha256Hex(body);
        var amzDate = requestTime.UtcDateTime.ToString("yyyyMMddTHHmmssZ");
        var dateStamp = requestTime.UtcDateTime.ToString("yyyyMMdd");

        request.Headers.Remove("x-amz-date");
        request.Headers.Remove("x-amz-content-sha256");
        request.Headers.TryAddWithoutValidation("x-amz-date", amzDate);
        request.Headers.TryAddWithoutValidation("x-amz-content-sha256", payloadHash);

        var canonicalUri = request.RequestUri?.AbsolutePath ?? "/";
        var canonicalQuery = CanonicalizeQuery(request.RequestUri);
        var host = request.RequestUri?.Authority ?? throw new InvalidOperationException("S3 request URI is required.");
        var canonicalHeaders = new StringBuilder()
            .Append("host:").Append(host).Append('\n')
            .Append("x-amz-content-sha256:").Append(payloadHash).Append('\n')
            .Append("x-amz-date:").Append(amzDate).Append('\n')
            .ToString();
        const string signedHeaders = "host;x-amz-content-sha256;x-amz-date";

        var canonicalRequest = string.Join(
            '\n',
            request.Method.Method,
            canonicalUri,
            canonicalQuery,
            canonicalHeaders,
            signedHeaders,
            payloadHash);

        var scope = $"{dateStamp}/{_options.Region}/s3/aws4_request";
        var stringToSign = string.Join(
            '\n',
            Algorithm,
            amzDate,
            scope,
            ComputeSha256Hex(Encoding.UTF8.GetBytes(canonicalRequest)));

        var signingKey = DeriveSigningKey(_options.SecretKey, dateStamp, _options.Region, "s3");
        var signature = ComputeHmacHex(signingKey, stringToSign);
        var authorization =
            $"{Algorithm} Credential={_options.AccessKey}/{scope}, SignedHeaders={signedHeaders}, Signature={signature}";

        request.Headers.Remove("Authorization");
        request.Headers.TryAddWithoutValidation("Authorization", authorization);
    }

    private static string CanonicalizeQuery(Uri? uri)
    {
        if (uri is null || string.IsNullOrWhiteSpace(uri.Query))
        {
            return string.Empty;
        }

        var query = uri.Query.TrimStart('?');
        var parts = query.Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(pair =>
            {
                var index = pair.IndexOf('=');
                if (index < 0)
                {
                    return (Key: Uri.EscapeDataString(Uri.UnescapeDataString(pair)), Value: string.Empty);
                }

                var key = pair[..index];
                var value = pair[(index + 1)..];
                return (
                    Key: Uri.EscapeDataString(Uri.UnescapeDataString(key)),
                    Value: Uri.EscapeDataString(Uri.UnescapeDataString(value)));
            })
            .OrderBy(x => x.Key, StringComparer.Ordinal)
            .ThenBy(x => x.Value, StringComparer.Ordinal)
            .Select(x => $"{x.Key}={x.Value}");

        return string.Join("&", parts);
    }

    private static byte[] DeriveSigningKey(string secretKey, string dateStamp, string region, string service)
    {
        var kSecret = Encoding.UTF8.GetBytes($"AWS4{secretKey}");
        var kDate = ComputeHmac(kSecret, dateStamp);
        var kRegion = ComputeHmac(kDate, region);
        var kService = ComputeHmac(kRegion, service);
        return ComputeHmac(kService, "aws4_request");
    }

    private static byte[] ComputeHmac(byte[] key, string data)
    {
        using var hmac = new HMACSHA256(key);
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
    }

    private static string ComputeHmacHex(byte[] key, string data)
    {
        return Convert.ToHexString(ComputeHmac(key, data)).ToLowerInvariant();
    }

    private static string ComputeSha256Hex(byte[] data)
    {
        return Convert.ToHexString(SHA256.HashData(data)).ToLowerInvariant();
    }

    private static string NormalizeKey(string key)
    {
        var normalized = key.Replace('\\', '/').Trim('/');
        if (string.IsNullOrWhiteSpace(normalized))
        {
            throw new InvalidOperationException("File key cannot be empty.");
        }

        if (normalized.Contains("..", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("File key contains invalid path traversal.");
        }

        return normalized;
    }

    private sealed class ResponseOwnedStream : Stream
    {
        private readonly Stream _inner;
        private readonly HttpResponseMessage _response;

        public ResponseOwnedStream(Stream inner, HttpResponseMessage response)
        {
            _inner = inner;
            _response = response;
        }

        public override bool CanRead => _inner.CanRead;
        public override bool CanSeek => _inner.CanSeek;
        public override bool CanWrite => _inner.CanWrite;
        public override long Length => _inner.Length;
        public override long Position
        {
            get => _inner.Position;
            set => _inner.Position = value;
        }

        public override void Flush() => _inner.Flush();
        public override int Read(byte[] buffer, int offset, int count) => _inner.Read(buffer, offset, count);
        public override long Seek(long offset, SeekOrigin origin) => _inner.Seek(offset, origin);
        public override void SetLength(long value) => _inner.SetLength(value);
        public override void Write(byte[] buffer, int offset, int count) => _inner.Write(buffer, offset, count);

        public override async ValueTask DisposeAsync()
        {
            await _inner.DisposeAsync();
            _response.Dispose();
            await base.DisposeAsync();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _inner.Dispose();
                _response.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
