using Microsoft.Extensions.Options;

namespace LoomaPos.Infrastructure.Storage;

public sealed class LocalFileStorage : IFileStorage
{
    private readonly string _rootPath;

    public LocalFileStorage(IOptions<FileStorageOptions> options)
    {
        var configuredPath = options.Value.LocalRootPath;
        _rootPath = string.IsNullOrWhiteSpace(configuredPath)
            ? Path.Combine(AppContext.BaseDirectory, "uploads")
            : configuredPath;

        Directory.CreateDirectory(_rootPath);
    }

    public async Task UploadAsync(string key, Stream content, string contentType, CancellationToken cancellationToken)
    {
        var filePath = GetFilePath(key);
        var directoryPath = Path.GetDirectoryName(filePath);
        if (!string.IsNullOrWhiteSpace(directoryPath))
        {
            Directory.CreateDirectory(directoryPath);
        }

        await using var fileStream = new FileStream(
            filePath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 81920,
            useAsync: true);
        await content.CopyToAsync(fileStream, cancellationToken);
    }

    public Task<StoredFileContent?> OpenReadAsync(string key, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var filePath = GetFilePath(key);
        if (!File.Exists(filePath))
        {
            return Task.FromResult<StoredFileContent?>(null);
        }

        Stream fileStream = new FileStream(
            filePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            bufferSize: 81920,
            useAsync: true);
        var contentType = GuessContentType(filePath);
        return Task.FromResult<StoredFileContent?>(new StoredFileContent(fileStream, contentType));
    }

    private string GetFilePath(string key)
    {
        var normalizedKey = NormalizeKey(key);
        var fragments = normalizedKey.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var filePath = Path.Combine(new[] { _rootPath }.Concat(fragments).ToArray());
        return filePath;
    }

    private static string NormalizeKey(string key)
    {
        var normalized = key.Replace('\\', '/').Trim('/');
        if (string.IsNullOrWhiteSpace(normalized))
        {
            throw new InvalidOperationException("File key cannot be empty.");
        }

        if (normalized.Contains("..", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("File key contains invalid path traversal.");
        }

        return normalized;
    }

    private static string GuessContentType(string filePath)
    {
        return Path.GetExtension(filePath).ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".jpg" => "image/jpeg",
            ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".svg" => "image/svg+xml",
            ".gif" => "image/gif",
            _ => "application/octet-stream"
        };
    }
}
