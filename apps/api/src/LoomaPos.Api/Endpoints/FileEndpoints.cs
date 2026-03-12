using LoomaPos.Infrastructure.Storage;

namespace LoomaPos.Api.Endpoints;

public static class FileEndpoints
{
    public static RouteGroupBuilder MapFileEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/files/{**key}", GetFileAsync)
            .WithName("GetFile")
            .WithSummary("Returns a stored file by key.");

        return group;
    }

    private static async Task<IResult> GetFileAsync(
        string key,
        IFileStorage fileStorage,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            return Results.BadRequest(new { error = "File key is required." });
        }

        var file = await fileStorage.OpenReadAsync(key, cancellationToken);
        if (file is null)
        {
            return Results.NotFound();
        }

        return Results.Stream(
            file.Stream,
            file.ContentType,
            enableRangeProcessing: true);
    }
}
