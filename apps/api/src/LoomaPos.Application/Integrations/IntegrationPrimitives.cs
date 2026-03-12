using System.Security.Cryptography;
using System.Text;

namespace LoomaPos.Application.Integrations;

public static class WebhookSignatureV1
{
    public static string BuildHeader(string secret, string payload, string timestamp)
    {
        return $"t={timestamp},v1={Compute(secret, payload, timestamp)}";
    }

    public static string Compute(string secret, string payload, string timestamp)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var bytes = Encoding.UTF8.GetBytes($"{timestamp}.{payload}");
        return Convert.ToHexString(hmac.ComputeHash(bytes)).ToLowerInvariant();
    }

    public static bool Verify(string secret, string payload, string timestamp, string expectedSignature)
    {
        var actual = Compute(secret, payload, timestamp);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(actual),
            Encoding.UTF8.GetBytes(expectedSignature.ToLowerInvariant()));
    }
}

public static class ApiScopeSet
{
    public static bool Allows(IEnumerable<string> grantedScopes, params string[] requiredScopes)
    {
        var granted = new HashSet<string>(
            grantedScopes.Where(scope => !string.IsNullOrWhiteSpace(scope)).Select(Normalize),
            StringComparer.OrdinalIgnoreCase);

        return requiredScopes.All(scope => granted.Contains(Normalize(scope)));
    }

    public static string Normalize(string scope) => scope.Trim().ToLowerInvariant();
}

public static class IntegrationRetryClassifier
{
    public static string Classify(int statusCode, bool credentialsExpired = false)
    {
        if (credentialsExpired)
        {
            return "credential_expired";
        }

        if (statusCode == 408 || statusCode == 429)
        {
            return "retry_later";
        }

        if (statusCode >= 500)
        {
            return "retryable";
        }

        if (statusCode is >= 400 and < 500)
        {
            return "rejected";
        }

        return "accepted";
    }

    public static bool ShouldRetry(string classification)
    {
        return classification is "retryable" or "retry_later";
    }
}

public static class IntegrationMappingValidator
{
    public static IReadOnlyList<string> MissingRequiredMappings(IEnumerable<string> availableMappingTypes, IEnumerable<string> requiredMappingTypes)
    {
        var available = new HashSet<string>(
            availableMappingTypes.Where(type => !string.IsNullOrWhiteSpace(type)).Select(type => type.Trim()),
            StringComparer.OrdinalIgnoreCase);

        return requiredMappingTypes
            .Where(type => !string.IsNullOrWhiteSpace(type) && !available.Contains(type.Trim()))
            .Select(type => type.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }
}
