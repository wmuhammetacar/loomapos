using LoomaPos.Application.Analytics;

namespace LoomaPos.UnitTests.Analytics;

public sealed class AnalyticsMetricEngineTests
{
    [Fact]
    public void CalculateRetailKpis_ShouldSubtractRefunds_AndExcludeVoids()
    {
        var result = AnalyticsMetricEngine.CalculateRetailKpis(new RetailMetricInput(
            GrossSales: 1000m,
            RefundAmount: 150m,
            CompletedTransactionCount: 10,
            VoidCount: 2,
            UnitsSold: 24m,
            CashTotal: 300m,
            CardTotal: 700m,
            LowStockItemCount: 3,
            StockAdjustmentCount: 1,
            StaffTransactionCount: 10,
            CashDiscrepancyCount: 0,
            PreviousGrossSales: 800m));

        Assert.Equal(1000m, result.GrossSales);
        Assert.Equal(850m, result.NetSales);
        Assert.Equal(0.15m, result.RefundRate);
        Assert.Equal(8, result.EffectiveTransactionCount);
        Assert.Equal(106.25m, result.AverageBasketValue);
    }

    [Fact]
    public void CalculateSaasKpis_ShouldComputeCoreRates()
    {
        var result = AnalyticsMetricEngine.CalculateSaasKpis(new SaasMetricInput(
            ActivePayingTenants: 20,
            TrialTenants: 5,
            MonthlyRecurringRevenue: 120000m,
            SuccessfulRenewals: 18,
            RenewalAttempts: 20,
            FailedPayments: 2,
            ActiveDevices: 60,
            TotalTenantsForDeviceAverage: 20,
            OpenSupportCases: 4,
            LicenseRevocationCount: 1,
            ReferredLeads: 50,
            ConvertedResellerCustomers: 10,
            CouponRedemptions: 8,
            CouponOfferCount: 40,
            ChurnRiskCount: 3));

        Assert.Equal(0.9m, result.RenewalSuccessRate);
        Assert.Equal(0.1m, result.PaymentFailureRate);
        Assert.Equal(3m, result.AverageDevicesPerTenant);
        Assert.Equal(0.2m, result.ResellerConversionRate);
        Assert.Equal(0.2m, result.CouponRedemptionRate);
    }

    [Fact]
    public void DetectAnomalies_ShouldFlagRefundSpike()
    {
        var anomalies = AnalyticsMetricEngine.DetectAnomalies(new AnalyticsAnomalySignalInput(
            TenantId: "tenant-1",
            BranchId: "branch-1",
            RefundRate: 0.22m,
            BaselineRefundRate: 0.08m,
            FailedSyncCount: 0,
            NegativeStockIncidents: 0,
            PaymentFailureRate: 0.05m,
            DeviceActivationBursts: 0));

        var refundSpike = Assert.Single(anomalies);
        Assert.Equal("refund_spike", refundSpike.Type);
        Assert.Contains("refund_rate:22%", refundSpike.EvidenceSignals);
        Assert.Equal("rules-v1", refundSpike.RuleVersion);
    }

    [Fact]
    public void BuildRecommendations_ShouldIncludeEvidence_AndAction()
    {
        var recommendations = AnalyticsMetricEngine.BuildRecommendations(new AnalyticsRecommendationSignalInput(
            TenantId: "tenant-1",
            ActiveDevices: 19,
            DeviceLimit: 20,
            LowStockHotProducts: 2,
            HighRefundProducts: 1,
            PaymentFailures: 1,
            HealthScore: 52));

        Assert.Contains(recommendations, item => item.Type == "plan_upgrade");
        Assert.All(recommendations, item =>
        {
            Assert.NotEmpty(item.Explanation);
            Assert.NotEmpty(item.RecommendedAction);
            Assert.NotEmpty(item.EvidenceSignals);
        });
    }

    [Fact]
    public void CalculateCustomerHealth_ShouldMarkAtRisk_WhenSignalsAreWeak()
    {
        var result = AnalyticsMetricEngine.CalculateCustomerHealth(new CustomerHealthSignalInput(
            SubscriptionStatus: "past_due",
            FailedPayments: 2,
            OpenSupportCases: 4,
            ActiveDevices: 0,
            DaysSinceLastHeartbeat: 12,
            PlanLimitPressurePercent: 95,
            OnboardingComplete: false));

        Assert.Equal("at_risk", result.Status);
        Assert.True(result.Score < 60);
        Assert.Contains("subscription_status:past_due", result.Drivers);
    }

    [Fact]
    public void BuildCsv_ShouldEscapeSpecialCharacters()
    {
        var csv = AnalyticsExportFormatter.BuildCsv(
            ["name", "note"],
            [["Market 1", "plain"], ["Market, 2", "contains \"quote\""]]);

        Assert.Contains("\"Market, 2\"", csv);
        Assert.Contains("\"contains \"\"quote\"\"\"", csv);
    }
}
