using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Queries.GetById;

public sealed record GetOrderByIdQuery(Guid Id) : IQuery<Result<OrderDto>>;
