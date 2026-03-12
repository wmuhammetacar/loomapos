using System.Security.Claims;
using System.Text.Json;

namespace LoomaPos.Api.Security;

public static class RoleClaims
{
    private static readonly IReadOnlyDictionary<string, string[]> RoleAliases =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["tenant_admin"] = ["tenant_admin", "admin", "administrator", "yonetici"],
            ["branch_manager"] = ["branch_manager", "sube_yoneticisi", "branchadmin"],
            ["cashier"] = ["cashier", "kasiyer"]
        };

    public static bool HasAnyRole(ClaimsPrincipal user, params string[] roles)
    {
        var acceptedRoles = ExpandRoles(roles);
        foreach (var role in ExtractRoles(user).Select(NormalizeRole))
        {
            if (acceptedRoles.Contains(role))
            {
                return true;
            }
        }

        return false;
    }

    public static IReadOnlyCollection<string> ExtractRoles(ClaimsPrincipal user)
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var claim in user.Claims.Where(c =>
                     c.Type == ClaimTypes.Role || c.Type == "role" || c.Type == "roles"))
        {
            foreach (var role in claim.Value.Split([',', ' '], StringSplitOptions.RemoveEmptyEntries))
            {
                roles.Add(role.Trim());
            }
        }

        var realmAccessRaw = user.FindFirst("realm_access")?.Value;
        if (string.IsNullOrWhiteSpace(realmAccessRaw))
        {
            return roles;
        }

        try
        {
            using var document = JsonDocument.Parse(realmAccessRaw);
            if (!document.RootElement.TryGetProperty("roles", out var rolesElement)
                || rolesElement.ValueKind != JsonValueKind.Array)
            {
                return roles;
            }

            foreach (var item in rolesElement.EnumerateArray())
            {
                var role = item.GetString();
                if (!string.IsNullOrWhiteSpace(role))
                {
                    roles.Add(role);
                }
            }
        }
        catch (JsonException)
        {
            // Ignore malformed realm_access claim.
        }

        return roles;
    }

    private static HashSet<string> ExpandRoles(IEnumerable<string> roles)
    {
        var expanded = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var role in roles)
        {
            if (string.IsNullOrWhiteSpace(role))
            {
                continue;
            }

            var normalized = NormalizeRole(role);
            expanded.Add(normalized);

            if (RoleAliases.TryGetValue(normalized, out var aliases))
            {
                foreach (var alias in aliases)
                {
                    expanded.Add(alias);
                }
            }
        }

        return expanded;
    }

    private static string NormalizeRole(string value) =>
        value.Trim().Replace("-", "_", StringComparison.Ordinal).ToLowerInvariant();
}
