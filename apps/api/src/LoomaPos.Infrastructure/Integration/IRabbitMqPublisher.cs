namespace LoomaPos.Infrastructure.Integration;

public interface IRabbitMqPublisher
{
    Task PublishAsync(string routingKey, object payload, CancellationToken cancellationToken);
}
