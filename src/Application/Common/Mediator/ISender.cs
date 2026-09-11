namespace MathilensERP.Application.Common.Mediator;

/// <summary>
/// The single abstraction the Api layer depends on to dispatch commands/queries
/// (01_ARCHITECTURE.md § 25.3 Mediator) — controllers never depend on concrete handler classes.
/// </summary>
public interface ISender
{
    Task<TResponse> Send<TResponse>(ICommand<TResponse> command, CancellationToken cancellationToken = default);

    Task<TResponse> Send<TResponse>(IQuery<TResponse> query, CancellationToken cancellationToken = default);
}
