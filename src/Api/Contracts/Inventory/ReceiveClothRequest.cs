using MathilensERP.Domain.Inventory;

namespace MathilensERP.Api.Contracts.Inventory;

/// <summary>
/// <c>ClothPriceId</c> is the price-list entry that arrived — chosen, not typed, so the log always
/// matches the catalogue. <c>RatePerUnit</c> is what the shop paid per unit, null until the bill arrives.
/// </summary>
public sealed record ReceiveClothRequest(
    Guid ClothPriceId,
    decimal Quantity,
    ClothUnit Unit,
    DateOnly ReceivedOn,
    string? SupplierName,
    string? InvoiceNumber,
    decimal? RatePerUnit,
    string? Notes);
