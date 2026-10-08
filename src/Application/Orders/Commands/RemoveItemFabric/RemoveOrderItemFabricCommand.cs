using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.RemoveItemFabric;

/// <summary>Removes one cloth from an item on an existing order, by the cloth's id.</summary>
public sealed record RemoveOrderItemFabricCommand(
    Guid OrderId,
    Guid OrderItemId,
    Guid FabricId) : ICommand<Result<OrderDto>>;
