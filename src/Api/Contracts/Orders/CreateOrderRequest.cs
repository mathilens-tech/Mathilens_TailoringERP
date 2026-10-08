using MathilensERP.Domain.Inventory;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;

namespace MathilensERP.Api.Contracts.Orders;

/// <param name="IsFabricSale">
/// Cloth sold over the counter with nothing to stitch. Recorded as Sold and finished on the spot —
/// no tailor, no lifecycle, and <c>DueAtUtc</c> read as the moment of sale. Defaults to false, so
/// every caller written before sales existed keeps taking tailoring orders unchanged.
/// </param>
public sealed record CreateOrderRequest(
    Guid CustomerId,
    Guid? EmployeeId,
    DateTime DueAtUtc,
    IReadOnlyList<CreateOrderItemRequest> Items,
    string? Notes = null,
    bool IsFabricSale = false);

/// <param name="Fabrics">
/// Every cloth this garment is cut from — empty or omitted for a customer's own material, one for an
/// ordinary line, several when one garment is made from a few. Nullable so a client written against
/// the single-cloth shape is not broken outright; the controller treats null as "no cloth".
/// </param>
public sealed record CreateOrderItemRequest(string GarmentType, int Quantity, decimal UnitPrice, IReadOnlyList<CreateOrderItemFabricRequest>? Fabrics);

/// <summary><c>ClothCode</c> is resolved against the price list; a match is what lets stock fall.
/// <c>RatePerMetre</c> is what a metre of this cloth is billed at, so several cloths on one garment
/// each price their own length.</summary>
public sealed record CreateOrderItemFabricRequest(
    string FabricType,
    FabricSource Source,
    string? Color,
    decimal Quantity,
    decimal RatePerMetre = 0m,
    string? ClothCode = null,
    ClothUnit Unit = ClothUnit.Metres);
