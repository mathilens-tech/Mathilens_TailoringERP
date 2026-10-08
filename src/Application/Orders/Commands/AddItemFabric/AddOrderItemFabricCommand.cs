using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Domain.Inventory;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.AddItemFabric;

/// <summary>
/// Adds one cloth to an item on an existing order. Called once per cloth, so a garment already on
/// the order can be given a second or third cloth without disturbing the ones it has.
/// </summary>
public sealed record AddOrderItemFabricCommand(
    Guid OrderId,
    Guid OrderItemId,
    string FabricType,
    FabricSource Source,
    string? Color,
    decimal Quantity,
    decimal RatePerMetre = 0m,
    string? ClothCode = null,
    ClothUnit Unit = ClothUnit.Metres) : ICommand<Result<OrderDto>>;
