namespace LoomaPos.Infrastructure.Storage;

public sealed class StoredFileContent : IAsyncDisposable
{
    public StoredFileContent(Stream stream, string contentType)
    {
        Stream = stream;
        ContentType = contentType;
    }

    public Stream Stream { get; }
    public string ContentType { get; }

    public ValueTask DisposeAsync()
    {
        return Stream.DisposeAsync();
    }
}
