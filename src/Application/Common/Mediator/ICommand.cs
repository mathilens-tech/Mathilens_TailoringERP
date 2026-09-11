namespace MathilensERP.Application.Common.Mediator;

/// <summary>
/// A request that mutates state, per CQRS (00_MASTER_SPEC.md § 4.7). <typeparamref name="TResponse"/>
/// is typically <c>Result</c> or <c>Result&lt;T&gt;</c> — command handlers model expected
/// failures as data, not exceptions (01_ARCHITECTURE.md § 13 Exception Strategy).
/// </summary>
public interface ICommand<TResponse>
{
}
