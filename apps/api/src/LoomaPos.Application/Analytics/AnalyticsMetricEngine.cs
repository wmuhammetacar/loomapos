namespace LoomaPos.Application.Analytics;

public sealed record RetailMetricInput(
    decimal GrossSales,
    decimal RefundAmount,
    int CompletedTransactionCount,
    int VoidCount,
    decimal UnitsSold,
    decimal CashTotal,
    decimal CardTotal,
    int LowStockItemCount,
    int StockAdjustmentCount,
    int StaffTransactionCount,
    int CashDiscrepancyCount,
    decimal PreviousGrossSales);

public sealed record RetailKpiSnapshot(
    decimal GrossSales,
    decimal NetSales,
    decimal RefundAmount,
    decimal RefundRate,
    int TransactionCount,
    int EffectiveTransactionCount,
    decimal AverageBasketValue,
    decimal UnitsSold,
    decimal CashVsCardRatio,
    decimal BranchGrowthRate,
    int LowStockItemCount,
    int StockAdjustmentCount,
    int StaffTransactionCount,
    int CashDiscrepancyCount);

public sealed record SaasMetricInput(
    int ActivePayingTenants,
    int TrialTenants,
    decimal MonthlyRecurringRevenue,
    int SuccessfulRenewals,
    int RenewalAttempts,
    int FailedPayments,
    int ActiveDevices,
    int TotalTenantsForDeviceAverage,
    int OpenSupportCases,
    int LicenseRevocationCount,
    int ReferredLeads,
    int ConvertedResellerCustomers,
    int CouponRedemptions,
    int CouponOfferCount,
    int ChurnRiskCount);

public sealed record SaasKpiSnapshot(
    int ActivePayingTenants,
    int TrialTenants,
    decimal Mrr,
    decimal RenewalSuccessRate,
    decimal PaymentFailureRate,
    int ActiveDevices,
    decimal AverageDevicesPerTenant,
    int SupportCaseOpenCount,
    int LicenseRevocationCount,
    decimal ResellerConversionRate,
    decimal CouponRedemptionRate,
    int ChurnRiskCount);

public sealed record AnalyticsAnomalySignalInput(
    string TenantId,
    string? BranchId,
    decimal RefundRate,
    decimal BaselineRefundRate,
    int FailedSyncCount,
    int NegativeStockIncidents,
    decimal PaymentFailureRate,
    int DeviceActivationBursts);

public sealed record AnalyticsAnomalyRecord(
    string Type,
    string Severity,
    string Explanation,
    string SuggestedFollowUp,
    string BaselinePeriod,
    string ComparisonPeriod,
    string RuleVersion,
    IReadOnlyList<string> EvidenceSignals);

public sealed record AnalyticsRecommendationSignalInput(
    string TenantId,
    int ActiveDevices,
    int? DeviceLimit,
    int LowStockHotProducts,
    int HighRefundProducts,
    int PaymentFailures,
    int HealthScore);

public sealed record AnalyticsRecommendationRecord(
    string Type,
    string TargetEntity,
    string Explanation,
    string RecommendedAction,
    decimal ConfidenceScore,
    string RuleVersion,
    IReadOnlyList<string> EvidenceSignals);

public sealed record CustomerHealthSignalInput(
    string SubscriptionStatus,
    int FailedPayments,
    int OpenSupportCases,
    int ActiveDevices,
    int DaysSinceLastHeartbeat,
    int PlanLimitPressurePercent,
    bool OnboardingComplete);

public sealed record CustomerHealthScoreSnapshot(
    int Score,
    string Status,
    IReadOnlyList<string> Drivers);

public static class AnalyticsMetricEngine
{
    public static RetailKpiSnapshot CalculateRetailKpis(RetailMetricInput input)
    {
        var transactionCount = Math.Max(0, input.CompletedTransactionCount);
        var effectiveTransactionCount = Math.Max(0, transactionCount - Math.Max(0, input.VoidCount));
        var grossSales = Round2(input.GrossSales);
        var refundAmount = Round2(Math.Max(0m, input.RefundAmount));
        var netSales = Round2(Math.Max(0m, grossSales - refundAmount));
        var refundRate = grossSales <= 0m ? 0m : Round4(refundAmount / grossSales);
        var averageBasket = effectiveTransactionCount == 0 ? 0m : Round2(netSales / effectiveTransactionCount);
        var cashVsCardRatio = input.CardTotal <= 0m
            ? (input.CashTotal > 0m ? 1m : 0m)
            : Round4(input.CashTotal / input.CardTotal);
        var growthRate = input.PreviousGrossSales <= 0m
            ? 0m
            : Round4((grossSales - input.PreviousGrossSales) / input.PreviousGrossSales);

        return new RetailKpiSnapshot(
            grossSales,
            netSales,
            refundAmount,
            refundRate,
            transactionCount,
            effectiveTransactionCount,
            averageBasket,
            Round2(input.UnitsSold),
            cashVsCardRatio,
            growthRate,
            Math.Max(0, input.LowStockItemCount),
            Math.Max(0, input.StockAdjustmentCount),
            Math.Max(0, input.StaffTransactionCount),
            Math.Max(0, input.CashDiscrepancyCount));
    }

    public static SaasKpiSnapshot CalculateSaasKpis(SaasMetricInput input)
    {
        var renewalSuccessRate = input.RenewalAttempts == 0
            ? 0m
            : Round4((decimal)input.SuccessfulRenewals / input.RenewalAttempts);
        var paymentFailureRate = input.RenewalAttempts == 0
            ? 0m
            : Round4((decimal)input.FailedPayments / input.RenewalAttempts);
        var averageDevicesPerTenant = input.TotalTenantsForDeviceAverage == 0
            ? 0m
            : Round2((decimal)input.ActiveDevices / input.TotalTenantsForDeviceAverage);
        var resellerConversionRate = input.ReferredLeads == 0
            ? 0m
            : Round4((decimal)input.ConvertedResellerCustomers / input.ReferredLeads);
        var couponRedemptionRate = input.CouponOfferCount == 0
            ? 0m
            : Round4((decimal)input.CouponRedemptions / input.CouponOfferCount);

        return new SaasKpiSnapshot(
            Math.Max(0, input.ActivePayingTenants),
            Math.Max(0, input.TrialTenants),
            Round2(input.MonthlyRecurringRevenue),
            renewalSuccessRate,
            paymentFailureRate,
            Math.Max(0, input.ActiveDevices),
            averageDevicesPerTenant,
            Math.Max(0, input.OpenSupportCases),
            Math.Max(0, input.LicenseRevocationCount),
            resellerConversionRate,
            couponRedemptionRate,
            Math.Max(0, input.ChurnRiskCount));
    }

    public static IReadOnlyList<AnalyticsAnomalyRecord> DetectAnomalies(AnalyticsAnomalySignalInput input)
    {
        var anomalies = new List<AnalyticsAnomalyRecord>();

        if (input.RefundRate >= input.BaselineRefundRate + 0.10m && input.RefundRate >= 0.15m)
        {
            anomalies.Add(new AnalyticsAnomalyRecord(
                "refund_spike",
                "high",
                $"Refund rate increased to {(input.RefundRate * 100m):0.#}% compared with {(input.BaselineRefundRate * 100m):0.#}% baseline.",
                "Inspect refund-heavy products and branch/device behavior.",
                "last_7_days",
                "previous_7_days",
                "rules-v1",
                new[]
                {
                    $"tenant:{input.TenantId}",
                    $"branch:{input.BranchId ?? "all"}",
                    $"refund_rate:{(input.RefundRate * 100m):0.#}%",
                    $"baseline:{(input.BaselineRefundRate * 100m):0.#}%"
                }));
        }

        if (input.FailedSyncCount >= 5)
        {
            anomalies.Add(new AnalyticsAnomalyRecord(
                "sync_failure_cluster",
                "medium",
                $"Failed sync batches reached {input.FailedSyncCount} in the current window.",
                "Inspect device-specific dead letters and retry saturation.",
                "last_24_hours",
                "current_window",
                "rules-v1",
                new[]
                {
                    $"tenant:{input.TenantId}",
                    $"failed_sync:{input.FailedSyncCount}"
                }));
        }

        if (input.NegativeStockIncidents > 0)
        {
            anomalies.Add(new AnalyticsAnomalyRecord(
                "negative_stock_incident",
                "medium",
                $"Detected {input.NegativeStockIncidents} negative stock incident(s) in the reporting window.",
                "Review stock policy, stale snapshots and recent adjustments.",
                "last_7_days",
                "current_window",
                "rules-v1",
                new[]
                {
                    $"tenant:{input.TenantId}",
                    $"negative_stock:{input.NegativeStockIncidents}"
                }));
        }

        if (input.DeviceActivationBursts >= 4)
        {
            anomalies.Add(new AnalyticsAnomalyRecord(
                "device_activation_burst",
                "medium",
                $"Device activation count reached {input.DeviceActivationBursts} in a short interval.",
                "Review license/device policy and suspicious activation loops.",
                "last_24_hours",
                "current_window",
                "rules-v1",
                new[]
                {
                    $"tenant:{input.TenantId}",
                    $"activation_burst:{input.DeviceActivationBursts}"
                }));
        }

        if (input.PaymentFailureRate >= 0.20m)
        {
            anomalies.Add(new AnalyticsAnomalyRecord(
                "payment_failure_spike",
                "high",
                $"Payment failure rate is {(input.PaymentFailureRate * 100m):0.#}% in the current period.",
                "Inspect billing provider status, renewal retries and card update flows.",
                "last_30_days",
                "current_window",
                "rules-v1",
                new[]
                {
                    $"tenant:{input.TenantId}",
                    $"payment_failure_rate:{(input.PaymentFailureRate * 100m):0.#}%"
                }));
        }

        return anomalies;
    }

    public static IReadOnlyList<AnalyticsRecommendationRecord> BuildRecommendations(AnalyticsRecommendationSignalInput input)
    {
        var recommendations = new List<AnalyticsRecommendationRecord>();

        if (input.DeviceLimit.HasValue && input.DeviceLimit.Value > 0)
        {
            var ratio = (decimal)input.ActiveDevices / input.DeviceLimit.Value;
            if (ratio >= 0.9m)
            {
                recommendations.Add(new AnalyticsRecommendationRecord(
                    "plan_upgrade",
                    input.TenantId,
                    $"Active devices reached {(ratio * 100m):0.#}% of the current device limit.",
                    "Review plan upgrade or deactivate unused devices before the next activation.",
                    0.86m,
                    "rules-v1",
                    new[]
                    {
                        $"active_devices:{input.ActiveDevices}",
                        $"device_limit:{input.DeviceLimit.Value}"
                    }));
            }
        }

        if (input.LowStockHotProducts > 0)
        {
            recommendations.Add(new AnalyticsRecommendationRecord(
                "restock_fast_sellers",
                input.TenantId,
                $"{input.LowStockHotProducts} fast-moving product(s) are close to stock-out.",
                "Prioritize replenishment for low-stock high-velocity products.",
                0.82m,
                "rules-v1",
                new[]
                {
                    $"low_stock_hot_products:{input.LowStockHotProducts}"
                }));
        }

        if (input.HighRefundProducts > 0)
        {
            recommendations.Add(new AnalyticsRecommendationRecord(
                "review_high_refund_products",
                input.TenantId,
                $"{input.HighRefundProducts} product(s) show elevated refund activity.",
                "Inspect pricing, quality or training issues on refund-heavy items.",
                0.74m,
                "rules-v1",
                new[]
                {
                    $"high_refund_products:{input.HighRefundProducts}"
                }));
        }

        if (input.PaymentFailures > 0)
        {
            recommendations.Add(new AnalyticsRecommendationRecord(
                "billing_recovery",
                input.TenantId,
                $"{input.PaymentFailures} payment failure(s) were detected in the billing window.",
                "Prompt card update or recovery outreach before the next renewal attempt.",
                0.79m,
                "rules-v1",
                new[]
                {
                    $"payment_failures:{input.PaymentFailures}"
                }));
        }

        if (input.HealthScore < 60)
        {
            recommendations.Add(new AnalyticsRecommendationRecord(
                "customer_success_outreach",
                input.TenantId,
                $"Customer health score is {input.HealthScore}, below the healthy threshold.",
                "Open a proactive support or customer-success follow-up.",
                0.77m,
                "rules-v1",
                new[]
                {
                    $"health_score:{input.HealthScore}"
                }));
        }

        return recommendations;
    }

    public static CustomerHealthScoreSnapshot CalculateCustomerHealth(CustomerHealthSignalInput input)
    {
        var score = 100;
        var drivers = new List<string>();

        if (input.SubscriptionStatus is "past_due" or "suspended" or "canceled")
        {
            score -= 30;
            drivers.Add($"subscription_status:{input.SubscriptionStatus}");
        }

        if (input.FailedPayments > 0)
        {
            score -= Math.Min(20, input.FailedPayments * 8);
            drivers.Add($"failed_payments:{input.FailedPayments}");
        }

        if (input.OpenSupportCases > 2)
        {
            score -= 10;
            drivers.Add($"open_support_cases:{input.OpenSupportCases}");
        }

        if (input.DaysSinceLastHeartbeat > 7)
        {
            score -= 15;
            drivers.Add($"heartbeat_gap_days:{input.DaysSinceLastHeartbeat}");
        }

        if (input.PlanLimitPressurePercent >= 90)
        {
            score -= 10;
            drivers.Add($"plan_limit_pressure:{input.PlanLimitPressurePercent}");
        }

        if (!input.OnboardingComplete)
        {
            score -= 10;
            drivers.Add("onboarding_incomplete");
        }

        if (input.ActiveDevices == 0)
        {
            score -= 10;
            drivers.Add("no_active_devices");
        }

        score = Math.Clamp(score, 0, 100);
        var status = score switch
        {
            >= 85 => "healthy",
            >= 60 => "watch",
            _ => "at_risk"
        };

        return new CustomerHealthScoreSnapshot(score, status, drivers);
    }

    private static decimal Round2(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
    private static decimal Round4(decimal value) => Math.Round(value, 4, MidpointRounding.AwayFromZero);
}

public static class AnalyticsExportFormatter
{
    public static string BuildCsv(IReadOnlyList<string> headers, IReadOnlyList<IReadOnlyList<string>> rows)
    {
        var lines = new List<string> { string.Join(",", headers.Select(Escape)) };
        lines.AddRange(rows.Select(row => string.Join(",", row.Select(Escape))));
        return string.Join(Environment.NewLine, lines);
    }

    private static string Escape(string value)
    {
        if (value.Contains('"') || value.Contains(',') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }
}
