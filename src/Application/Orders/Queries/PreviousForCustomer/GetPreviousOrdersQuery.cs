using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Queries.PreviousForCustomer;

/// <summary>The other orders belonging to the same person as <paramref name="OrderId"/>, found by phone number.</summary>
public sealed record GetPreviousOrdersQuery(Guid OrderId) : IQuery<Result<IReadOnlyList<OrderDto>>>;
