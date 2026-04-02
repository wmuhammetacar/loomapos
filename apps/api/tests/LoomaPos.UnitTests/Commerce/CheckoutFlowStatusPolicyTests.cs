using LoomaPos.Api.Commerce;

namespace LoomaPos.UnitTests.Commerce;

public sealed class CheckoutFlowStatusPolicyTests
{
    [Fact]
    public void ResolveProviderStart_NeverMarksImmediateSuccess()
    {
        var resolution = CheckoutFlowStatusPolicy.ResolveProviderStart("paid");

        Assert.Equal(CheckoutFlowStatusPolicy.PendingProvider, resolution.CheckoutStatus);
        Assert.Equal(CheckoutFlowStatusPolicy.PendingProvider, resolution.PaymentStatus);
        Assert.False(resolution.IsSuccessful);
        Assert.False(resolution.IsFinal);
    }

    [Theory]
    [InlineData("paid", CheckoutFlowStatusPolicy.Succeeded, true, true)]
    [InlineData("failed", CheckoutFlowStatusPolicy.Failed, false, true)]
    [InlineData("cancelled", CheckoutFlowStatusPolicy.Canceled, false, true)]
    [InlineData("expired", CheckoutFlowStatusPolicy.Expired, false, true)]
    [InlineData("pending", CheckoutFlowStatusPolicy.PendingProvider, false, false)]
    public void ResolveProviderCallback_MapsCanonicalStates(
        string providerStatus,
        string expectedStatus,
        bool expectedSuccess,
        bool expectedFinal)
    {
        var resolution = CheckoutFlowStatusPolicy.ResolveProviderCallback(providerStatus);

        Assert.Equal(expectedStatus, resolution.CheckoutStatus);
        Assert.Equal(expectedStatus == CheckoutFlowStatusPolicy.PendingProvider
            ? CheckoutFlowStatusPolicy.PendingProvider
            : expectedStatus, resolution.PaymentStatus);
        Assert.Equal(expectedSuccess, resolution.IsSuccessful);
        Assert.Equal(expectedFinal, resolution.IsFinal);
    }

    [Theory]
    [InlineData("payment_confirmed", CheckoutFlowStatusPolicy.Succeeded)]
    [InlineData("payment_failed", CheckoutFlowStatusPolicy.Failed)]
    [InlineData("awaiting_confirmation", CheckoutFlowStatusPolicy.PendingProvider)]
    [InlineData("pending_payment", CheckoutFlowStatusPolicy.Created)]
    public void NormalizeCheckoutStatus_MapsLegacyStates(string raw, string expected)
    {
        Assert.Equal(expected, CheckoutFlowStatusPolicy.NormalizeCheckoutStatus(raw));
    }

    [Theory]
    [InlineData(CheckoutFlowStatusPolicy.Succeeded, true)]
    [InlineData(CheckoutFlowStatusPolicy.Failed, false)]
    [InlineData(CheckoutFlowStatusPolicy.PendingProvider, false)]
    public void ShouldProvision_OnlyAllowsSucceeded(string status, bool expected)
    {
        Assert.Equal(expected, CheckoutFlowStatusPolicy.ShouldProvision(status));
    }

    [Theory]
    [InlineData(CheckoutFlowStatusPolicy.Succeeded, true)]
    [InlineData(CheckoutFlowStatusPolicy.Failed, true)]
    [InlineData(CheckoutFlowStatusPolicy.Canceled, true)]
    [InlineData(CheckoutFlowStatusPolicy.Expired, true)]
    [InlineData(CheckoutFlowStatusPolicy.PendingProvider, false)]
    [InlineData(CheckoutFlowStatusPolicy.Created, false)]
    public void IsFinal_TracksTerminalStates(string status, bool expected)
    {
        Assert.Equal(expected, CheckoutFlowStatusPolicy.IsFinal(status));
    }
}
