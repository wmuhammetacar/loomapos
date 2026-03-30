namespace LoomaPos.Infrastructure.Payments;

public interface IPaymentProviderResolver
{
    IPaymentProvider Resolve(string? providerCode);
    bool TryResolve(string? providerCode, out IPaymentProvider provider);
}

public sealed class PaymentProviderResolver : IPaymentProviderResolver
{
    private readonly IReadOnlyDictionary<string, IPaymentProvider> _providers;

    public PaymentProviderResolver(IEnumerable<IPaymentProvider> providers)
    {
        _providers = providers.ToDictionary(x => x.ProviderCode, StringComparer.OrdinalIgnoreCase);
    }

    public bool TryResolve(string? providerCode, out IPaymentProvider provider)
    {
        provider = default!;
        if (string.IsNullOrWhiteSpace(providerCode))
        {
            return false;
        }

        var normalized = providerCode.Trim().ToLowerInvariant();
        return _providers.TryGetValue(normalized, out provider!);
    }

    public IPaymentProvider Resolve(string? providerCode)
    {
        if (!TryResolve(providerCode, out var provider))
        {
            throw new InvalidOperationException("Unknown payment provider.");
        }

        return provider;
    }
}
