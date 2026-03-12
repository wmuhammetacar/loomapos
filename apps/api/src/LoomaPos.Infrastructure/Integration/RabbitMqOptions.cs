namespace LoomaPos.Infrastructure.Integration;

public sealed class RabbitMqOptions
{
    public bool Enabled { get; set; } = true;
    public string ManagementBaseUrl { get; set; } = "http://localhost:15672";
    public string Username { get; set; } = "loomapos";
    public string Password { get; set; } = "loomapos";
    public string VHost { get; set; } = "/";
    public string Exchange { get; set; } = "loomapos.events";
}
