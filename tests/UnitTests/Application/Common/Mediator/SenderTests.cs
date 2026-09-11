using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;
using Microsoft.Extensions.DependencyInjection;

namespace MathilensERP.UnitTests.Application.Common.Mediator;

file sealed record PingCommand(string Message) : ICommand<Result<string>>;

file sealed class PingCommandHandler : ICommandHandler<PingCommand, Result<string>>
{
    public Task<Result<string>> Handle(PingCommand command, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Success($"Pong: {command.Message}"));
}

file sealed record PingQuery(string Message) : IQuery<Result<string>>;

file sealed class PingQueryHandler : IQueryHandler<PingQuery, Result<string>>
{
    public Task<Result<string>> Handle(PingQuery query, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Success($"Query: {query.Message}"));
}

file sealed class RecordingBehavior : IPipelineBehavior<PingCommand, Result<string>>
{
    public static readonly List<string> CallOrder = [];

    public async Task<Result<string>> Handle(
        PingCommand request, RequestHandlerDelegate<Result<string>> next, CancellationToken cancellationToken)
    {
        CallOrder.Add("before");
        var result = await next();
        CallOrder.Add("after");
        return result;
    }
}

public class SenderTests
{
    [Fact]
    public async Task Send_Command_DispatchesToRegisteredHandler()
    {
        var provider = BuildProvider(services =>
            services.AddScoped<ICommandHandler<PingCommand, Result<string>>, PingCommandHandler>());
        var sender = provider.GetRequiredService<ISender>();

        var result = await sender.Send(new PingCommand("hello"));

        Assert.True(result.IsSuccess);
        Assert.Equal("Pong: hello", result.Value);
    }

    [Fact]
    public async Task Send_Query_DispatchesToRegisteredHandler()
    {
        var provider = BuildProvider(services =>
            services.AddScoped<IQueryHandler<PingQuery, Result<string>>, PingQueryHandler>());
        var sender = provider.GetRequiredService<ISender>();

        var result = await sender.Send(new PingQuery("world"));

        Assert.True(result.IsSuccess);
        Assert.Equal("Query: world", result.Value);
    }

    [Fact]
    public async Task Send_WithRegisteredPipelineBehavior_RunsBehaviorAroundHandler()
    {
        RecordingBehavior.CallOrder.Clear();
        var provider = BuildProvider(services =>
        {
            services.AddScoped<ICommandHandler<PingCommand, Result<string>>, PingCommandHandler>();
            services.AddScoped<IPipelineBehavior<PingCommand, Result<string>>, RecordingBehavior>();
        });
        var sender = provider.GetRequiredService<ISender>();

        await sender.Send(new PingCommand("hi"));

        Assert.Equal(["before", "after"], RecordingBehavior.CallOrder);
    }

    private static ServiceProvider BuildProvider(Action<IServiceCollection> configure)
    {
        var services = new ServiceCollection();
        services.AddScoped<ISender, Sender>();
        configure(services);
        return services.BuildServiceProvider();
    }
}
