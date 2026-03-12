namespace LoomaPos.Api.Ops;

public static class RuntimeSecretGuard
{
    private const string PlaceholderPrefix = "__SECRET_REF__";

    private static readonly string[] CriticalKeys =
    [
        "ConnectionStrings:Postgres",
        "ConnectionStrings:Redis",
        "Auth:Authority",
        "Auth:Audience"
    ];

    public static void Validate(IServiceProvider services, IConfiguration configuration, IWebHostEnvironment environment)
    {
        var loggerFactory = services.GetRequiredService<ILoggerFactory>();
        var logger = loggerFactory.CreateLogger("RuntimeSecretGuard");
        var allowPlaceholders = configuration.GetValue("Ops:AllowPlaceholderSecrets", false);
        var unresolved = new List<string>();

        foreach (var key in CriticalKeys)
        {
            var value = configuration[key];
            if (!string.IsNullOrWhiteSpace(value) &&
                value.StartsWith(PlaceholderPrefix, StringComparison.OrdinalIgnoreCase))
            {
                unresolved.Add(key);
            }
        }

        if (unresolved.Count == 0)
        {
            logger.LogInformation("Runtime secret guard passed.");
            return;
        }

        if (allowPlaceholders && !environment.IsProduction())
        {
            logger.LogWarning(
                "Runtime uses placeholder secrets for keys: {Keys}. This mode is allowed only outside production.",
                string.Join(", ", unresolved));
            return;
        }

        throw new InvalidOperationException(
            $"Unresolved secret references detected: {string.Join(", ", unresolved)}. " +
            "Set resolved environment values or enable Ops:AllowPlaceholderSecrets in non-production.");
    }
}
