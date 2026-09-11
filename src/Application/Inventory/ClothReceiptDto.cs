using MathilensERP.Domain.Inventory;

namespace MathilensERP.Application.Inventory;

/// <param name="TotalCost">Quantity × rate, or null when no rate was recorded. Computed, never stored.</param>
public sealed record ClothReceiptDto(
    Guid Id,
    Guid ClothPriceId,
    string ClothCode,
    string ClothName,
    decimal Quantity,
    ClothUnit Unit,
    DateOnly ReceivedOn,
    string? SupplierName,
    string? InvoiceNumber,
    decimal? RatePerUnit,
    decimal? TotalCost,
    string? Notes,
    DateTime CreatedAtUtc);
