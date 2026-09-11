using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.AddItem;

public sealed record AddOrderItemCommand(Guid OrderId, string GarmentType, int Quantity, decimal UnitPrice) : ICommand<Result<OrderDto>>;
