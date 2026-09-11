namespace MathilensERP.Application.Common.Mediator;

/// <summary>A request that never mutates state, shaped for its specific read use case (00_MASTER_SPEC.md § 4.7).</summary>
public interface IQuery<TResponse>
{
}
