namespace LoomaPos.Application.Ops;

public static class ProductionOpsPolicy
{
    public static string DetermineClientCompatibility(string currentVersion, string minimumSupportedVersion, string recommendedVersion)
    {
        if (CompareSemanticVersions(currentVersion, minimumSupportedVersion) < 0)
        {
            return "blocked";
        }

        if (CompareSemanticVersions(currentVersion, recommendedVersion) < 0)
        {
            return "upgrade_recommended";
        }

        return "supported";
    }

    public static string SummarizeDeploymentHealth(int activeAlerts, int openIncidents, int failedBackups)
    {
        if (openIncidents > 0 || failedBackups > 0)
        {
            return "degraded";
        }

        if (activeAlerts > 0)
        {
            return "watch";
        }

        return "healthy";
    }

    public static bool ShouldEscalateQueueBacklog(int pendingJobs, int failedJobs, int delayMinutes)
    {
        return pendingJobs >= 5000 || failedJobs >= 100 || delayMinutes >= 15;
    }

    private static int CompareSemanticVersions(string left, string right)
    {
        var leftParts = Normalize(left);
        var rightParts = Normalize(right);
        for (var index = 0; index < Math.Max(leftParts.Length, rightParts.Length); index++)
        {
            var leftValue = index < leftParts.Length ? leftParts[index] : 0;
            var rightValue = index < rightParts.Length ? rightParts[index] : 0;
            var comparison = leftValue.CompareTo(rightValue);
            if (comparison != 0)
            {
                return comparison;
            }
        }

        return 0;
    }

    private static int[] Normalize(string version)
    {
        return version
            .Split('-', StringSplitOptions.RemoveEmptyEntries)[0]
            .Split('.', StringSplitOptions.RemoveEmptyEntries)
            .Select(part => int.TryParse(part, out var parsed) ? parsed : 0)
            .ToArray();
    }
}
