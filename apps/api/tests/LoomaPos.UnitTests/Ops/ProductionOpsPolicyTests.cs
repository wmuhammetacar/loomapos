using LoomaPos.Application.Ops;

namespace LoomaPos.UnitTests.Ops;

public sealed class ProductionOpsPolicyTests
{
    [Fact]
    public void DetermineClientCompatibility_ShouldBlock_WhenClientBelowMinimum()
    {
        var result = ProductionOpsPolicy.DetermineClientCompatibility("2.2.9", "2.3.0", "2.4.1");

        Assert.Equal("blocked", result);
    }

    [Fact]
    public void DetermineClientCompatibility_ShouldRecommendUpgrade_WhenBelowRecommended()
    {
        var result = ProductionOpsPolicy.DetermineClientCompatibility("2.3.4", "2.3.0", "2.4.1");

        Assert.Equal("upgrade_recommended", result);
    }

    [Fact]
    public void SummarizeDeploymentHealth_ShouldReturnDegraded_WhenIncidentsExist()
    {
        var result = ProductionOpsPolicy.SummarizeDeploymentHealth(activeAlerts: 1, openIncidents: 1, failedBackups: 0);

        Assert.Equal("degraded", result);
    }

    [Fact]
    public void ShouldEscalateQueueBacklog_ShouldReturnTrue_ForHighDelay()
    {
        Assert.True(ProductionOpsPolicy.ShouldEscalateQueueBacklog(pendingJobs: 400, failedJobs: 0, delayMinutes: 15));
    }
}
