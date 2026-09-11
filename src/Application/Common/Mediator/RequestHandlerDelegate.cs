namespace MathilensERP.Application.Common.Mediator;

/// <summary>Continuation passed through a <see cref="IPipelineBehavior{TRequest,TResponse}"/> chain.</summary>
public delegate Task<TResponse> RequestHandlerDelegate<TResponse>();
