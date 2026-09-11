using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Domain.Inventory;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.Create;

/// <param name="IsFabricSale">
/// Cloth sold over the counter with nothing to stitch.
///
/// <para>The order is recorded as <see cref="OrderStatus.Sold"/> and is finished immediately: no
/// tailor, no lifecycle, no collection date to keep — <c>DueAtUtc</c> is taken as the moment of
/// sale. It is still an order and still invoiced like one, because a shop's takings are its
/// takings; what differs is that there is no work to track.</para>
///
/// <para>Per sale rather than per shop: a shop that stitches and sells cloth does both, sometimes
/// to the same customer on the same day.</para>
/// </param>
public sealed record CreateOrderCommand(
    Guid CustomerId,
    Guid? EmployeeId,
    DateTime DueAtUtc,
    IReadOnlyList<CreateOrderItemInput> Items,
    string? Notes = null,
    bool IsFabricSale = false) : ICommand<Result<OrderDto>>;

public sealed record CreateOrderItemInput(string GarmentType, int Quantity, decimal UnitPrice, CreateOrderItemFabricInput? Fabric);

/// <param name="ClothCode">
/// The cloth code staff typed. Resolved against the price list when the order is saved: a match
/// links the fabric to that catalogue entry so stock falls by <paramref name="Quantity"/>, and no
/// match is kept as free text, exactly as the field has always behaved.
/// </param>
public sealed record CreateOrderItemFabricInput(
    string FabricType,
    FabricSource Source,
    string? Color,
    decimal Quantity,
    string? ClothCode = null,
    ClothUnit Unit = ClothUnit.Metres);
