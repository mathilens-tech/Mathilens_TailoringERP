namespace MathilensERP.Application.Common.Mediator;

/// <summary>
/// A cross-cutting step that wraps handler execution (validation, logging — 01_ARCHITECTURE.md
/// § 11 Validation Strategy, § 12 Logging Strategy). Behaviors registered for a request type run
/// in registration order, each choosing whether to call <paramref name="next"/>.
/// </summary>
public interface IPipelineBehavior<TRequest, TResponse>
{
    Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken);
}
