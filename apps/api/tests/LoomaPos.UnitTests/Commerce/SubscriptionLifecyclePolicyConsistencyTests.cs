using LoomaPos.Api.Commerce;
using LoomaPos.Domain.Commerce;
using LoomaPos.Domain.Identity;

namespace LoomaPos.UnitTests.Commerce;

public sealed class SubscriptionLifecyclePolicyConsistencyTests
{
    public static IEnumerable<object[]> CanonicalMatrix()
    {
        yield return
        [
            SubscriptionLifecyclePolicy.TrialActive,
            true,
            true,
            true,
            true,
            false,
            false
        ];

        yield return
        [
            SubscriptionLifecyclePolicy.TrialExpiring,
            true,
            true,
            true,
            true,
            true,
            false
        ];

        yield return
        [
            SubscriptionLifecyclePolicy.TrialExpired,
            false,
            false,
            false,
            true,
            true,
            false
        ];

        yield return
        [
            SubscriptionLifecyclePolicy.SubscriptionActive,
            true,
            true,
            true,
            true,
            false,
            false
        ];

        yield return
        [
            SubscriptionLifecyclePolicy.SubscriptionPastDue,
            true,
            true,
            true,
            true,
            true,
            false
        ];

        yield return
        [
            SubscriptionLifecyclePolicy.SubscriptionCanceled,
            true,
            true,
            true,
            true,
            true,
            false
        ];

        yield return
        [
            SubscriptionLifecyclePolicy.SuspendedBlocked,
            false,
            false,
            false,
            true,
            true,
            true
        ];
    }

    public static IEnumerable<object[]> LegacyAliasMap()
    {
        yield return ["trial", SubscriptionLifecyclePolicy.TrialActive];
        yield return ["trial_expiring_soon", SubscriptionLifecyclePolicy.TrialExpiring];
        yield return ["trial_expired_read_only", SubscriptionLifecyclePolicy.TrialExpired];
        yield return ["past_due", SubscriptionLifecyclePolicy.SubscriptionPastDue];
        yield return ["canceled", SubscriptionLifecyclePolicy.SubscriptionCanceled];
        yield return ["blocked", SubscriptionLifecyclePolicy.SuspendedBlocked];
        yield return ["revoked", SubscriptionLifecyclePolicy.SuspendedBlocked];
    }

    public static IEnumerable<object[]> ResolveStateCases()
    {
        var now = new DateTimeOffset(2026, 03, 30, 12, 00, 00, TimeSpan.Zero);

        yield return
        [
            new Tenant { Status = "active" },
            new Subscription { Status = "trialing", TrialEndsAt = now.AddDays(9) },
            new IssuedLicense { Status = "active", ExpiresAt = now.AddDays(20) },
            now,
            SubscriptionLifecyclePolicy.TrialActive
        ];

        yield return
        [
            new Tenant { Status = "active" },
            new Subscription { Status = "trialing", TrialEndsAt = now.AddDays(2) },
            new IssuedLicense { Status = "active", ExpiresAt = now.AddDays(20) },
            now,
            SubscriptionLifecyclePolicy.TrialExpiring
        ];

        yield return
        [
            new Tenant { Status = "active" },
            new Subscription { Status = "trialing", TrialEndsAt = now.AddDays(-1) },
            new IssuedLicense { Status = "active", ExpiresAt = now.AddDays(20) },
            now,
            SubscriptionLifecyclePolicy.TrialExpired
        ];

        yield return
        [
            new Tenant { Status = "active" },
            new Subscription { Status = "active" },
            new IssuedLicense { Status = "active", ExpiresAt = now.AddDays(20) },
            now,
            SubscriptionLifecyclePolicy.SubscriptionActive
        ];

        yield return
        [
            new Tenant { Status = "active" },
            new Subscription { Status = "past_due" },
            new IssuedLicense { Status = "active", ExpiresAt = now.AddDays(20) },
            now,
            SubscriptionLifecyclePolicy.SubscriptionPastDue
        ];

        yield return
        [
            new Tenant { Status = "active" },
            new Subscription { Status = "canceled", CancelAtPeriodEnd = true },
            new IssuedLicense { Status = "active", ExpiresAt = now.AddDays(20) },
            now,
            SubscriptionLifecyclePolicy.SubscriptionCanceled
        ];

        yield return
        [
            new Tenant { Status = "suspended" },
            new Subscription { Status = "active" },
            new IssuedLicense { Status = "active", ExpiresAt = now.AddDays(20) },
            now,
            SubscriptionLifecyclePolicy.SuspendedBlocked
        ];
    }

    [Theory]
    [MemberData(nameof(CanonicalMatrix))]
    public void Describe_ReturnsCanonicalFlags(
        string state,
        bool canCheckout,
        bool canWrite,
        bool canSync,
        bool canView,
        bool requiresUpgradeAction,
        bool requiresBlock)
    {
        var descriptor = SubscriptionLifecyclePolicy.Describe(state);

        Assert.Equal(state, descriptor.State);
        Assert.Equal(canCheckout, descriptor.CanCheckout);
        Assert.Equal(canWrite, descriptor.CanWrite);
        Assert.Equal(canSync, descriptor.CanSync);
        Assert.Equal(canView, descriptor.CanView);
        Assert.Equal(requiresUpgradeAction, descriptor.RequiresUpgradeAction);
        Assert.Equal(requiresBlock, descriptor.RequiresBlock);
    }

    [Theory]
    [MemberData(nameof(LegacyAliasMap))]
    public void NormalizeState_MapsLegacyAliases(string rawState, string expected)
    {
        var normalized = SubscriptionLifecyclePolicy.NormalizeState(rawState);
        Assert.Equal(expected, normalized);
    }

    [Theory]
    [MemberData(nameof(ResolveStateCases))]
    public void ResolveState_EmitsCanonicalLifecycle(
        Tenant tenant,
        Subscription subscription,
        IssuedLicense license,
        DateTimeOffset now,
        string expected)
    {
        var resolved = SubscriptionLifecyclePolicy.ResolveState(tenant, subscription, license, now);
        Assert.Equal(expected, resolved);
    }

    [Theory]
    [InlineData(SubscriptionLifecyclePolicy.TrialActive, SubscriptionLifecyclePolicy.SubscriptionActive, true)]
    [InlineData(SubscriptionLifecyclePolicy.TrialExpiring, SubscriptionLifecyclePolicy.TrialExpired, true)]
    [InlineData(SubscriptionLifecyclePolicy.SubscriptionPastDue, SubscriptionLifecyclePolicy.SuspendedBlocked, true)]
    [InlineData(SubscriptionLifecyclePolicy.SubscriptionCanceled, SubscriptionLifecyclePolicy.TrialActive, false)]
    public void IsValidTransition_EnforcesCanonicalGraph(string fromState, string toState, bool expected)
    {
        var allowed = SubscriptionLifecyclePolicy.IsValidTransition(fromState, toState);
        Assert.Equal(expected, allowed);
    }
}
