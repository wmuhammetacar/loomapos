namespace LoomaPos.Infrastructure.Storage;

public sealed class FileStorageOptions
{
    public string Provider { get; set; } = "S3";
    public string? LocalRootPath { get; set; }

    public string Endpoint { get; set; } = "http://localhost:9000";
    public string Bucket { get; set; } = "loomapos-dev";
    public string AccessKey { get; set; } = "minioadmin";
    public string SecretKey { get; set; } = "minioadmin";
    public string Region { get; set; } = "us-east-1";
}
