namespace LoomaPos.Infrastructure.Storage;

public interface IFileStorage
{
    Task UploadAsync(string key, Stream content, string contentType, CancellationToken cancellationToken);
    Task<StoredFileContent?> OpenReadAsync(string key, CancellationToken cancellationToken);
}
