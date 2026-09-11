using System.Reflection;
using Microsoft.Extensions.DependencyInjection;

namespace MathilensERP.Application.Common.Mediator;

/// <summary>
/// Resolves the single registered handler for a command/query's concrete type, wraps it with
/// any registered <see cref="IPipelineBehavior{TRequest,TResponse}"/> instances for that same
/// type, and invokes the chain. This is the entire mediator — deliberately minimal (KISS,
/// 00_MASTER_SPEC.md § 4.4) rather than a general-purpose messaging library.
/// </summary>
public sealed class Sender : ISender
{
    private readonly IServiceProvider _serviceProvider;

    public Sender(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public Task<TResponse> Send<TResponse>(ICommand<TResponse> command, CancellationToken cancellationToken = default) =>
        Dispatch<TResponse>(command, typeof(ICommandHandler<,>), cancellationToken);

    public Task<TResponse> Send<TResponse>(IQuery<TResponse> query, CancellationToken cancellationToken = default) =>
        Dispatch<TResponse>(query, typeof(IQueryHandler<,>), cancellationToken);

    private Task<TResponse> Dispatch<TResponse>(object request, Type openHandlerType, CancellationToken cancellationToken)
    {
        var requestType = request.GetType();
        var handlerType = openHandlerType.MakeGenericType(requestType, typeof(TResponse));
        var handler = _serviceProvider.GetRequiredService(handlerType);
        var handleMethod = handlerType.GetMethod(nameof(ICommandHandler<ICommand<object>, object>.Handle))!;

        RequestHandlerDelegate<TResponse> handlerDelegate = () =>
            (Task<TResponse>)handleMethod.Invoke(handler, [request, cancellationToken])!;

        var behaviorType = typeof(IPipelineBehavior<,>).MakeGenericType(requestType, typeof(TResponse));
        var behaviors = _serviceProvider.GetServices(behaviorType).Reverse().ToList();
        var behaviorHandleMethod = behaviorType.GetMethod(nameof(IPipelineBehavior<object, object>.Handle))!;

        foreach (var behavior in behaviors)
        {
            var next = handlerDelegate;
            handlerDelegate = () =>
                (Task<TResponse>)behaviorHandleMethod.Invoke(behavior, [request, next, cancellationToken])!;
        }

        return handlerDelegate();
    }
}
