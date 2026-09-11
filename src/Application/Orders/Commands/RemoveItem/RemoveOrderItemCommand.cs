using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.RemoveItem;

public sealed record RemoveOrderItemCommand(Guid OrderId, Guid OrderItemId) : ICommand<Result<OrderDto>>;
