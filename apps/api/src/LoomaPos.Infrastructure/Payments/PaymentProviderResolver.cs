namespace LoomaPos.Infrastructure.Payments;

public interface IPaymentProviderResolver
{
    IPaymentProvider Resolve(string? providerCode);
}

public sealed class PaymentProviderResolver : IPaymentProviderResolver
{
    private readonly IReadOnlyDictionary<string, IPaymentProvider> _providers;

    public PaymentProviderResolver(IEnumerable<IPaymentProvider> providers)
    {
        _providers = providers.ToDictionary(x => x.ProviderCode, StringComparer.OrdinalIgnoreCase);
    }

    public IPaymentProvider Resolve(string? providerCode)
    {
        var normalized = string.IsNullOrWhiteSpace(providerCode) ? "mock" : providerCode.Trim().ToLowerInvariant();
        return _providers.TryGetValue(normalized, out var provider)
            ? provider
            : _providers["mock"];
    }
}
