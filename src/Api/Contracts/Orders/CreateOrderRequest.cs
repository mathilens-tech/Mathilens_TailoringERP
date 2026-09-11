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

public sealed record CreateOrderItemRequest(string GarmentType, int Quantity, decimal UnitPrice, CreateOrderItemFabricRequest? Fabric);

/// <summary><c>ClothCode</c> is resolved against the price list; a match is what lets stock fall.</summary>
public sealed record CreateOrderItemFabricRequest(
    string FabricType,
    FabricSource Source,
    string? Color,
    decimal Quantity,
    string? ClothCode = null,
    ClothUnit Unit = ClothUnit.Metres);
