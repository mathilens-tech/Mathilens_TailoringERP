using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.UpdateItem;

public sealed record UpdateOrderItemCommand(
    Guid OrderId,
    Guid OrderItemId,
    string GarmentType,
    int Quantity,
    decimal UnitPrice) : ICommand<Result<OrderDto>>;
