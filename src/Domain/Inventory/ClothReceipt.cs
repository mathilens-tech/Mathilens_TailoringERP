using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Inventory;

/// <summary>
/// One delivery of cloth into the shop: what arrived, how much, from whom, and what it cost.
///
/// A record of an event, not a running balance. Nothing here is netted off when an order uses
/// cloth — orders do not record which cloth code they consumed, so a stock figure derived from
/// these alone would be wrong in a way nobody could see. This is the log the shop reconciles
/// against its supplier bills.
///
/// <see cref="ClothCode"/> and <see cref="ClothName"/> are copied from the price list at the time
/// of receipt rather than joined on read, for the same reason the activity trail copies a user
/// name: the receipt must still say what physically arrived after the catalogue entry is renamed,
/// re-priced or removed.
/// </summary>
public sealed class ClothReceipt : AuditableEntity
{
    /// <summary>The price-list entry this cloth was received against.</summary>
    public Guid ClothPriceId { get; private set; }

    public string ClothCode { get; private set; } = string.Empty;

    public string ClothName { get; private set; } = string.Empty;

    public decimal Quantity { get; private set; }

    public ClothUnit Unit { get; private set; }

    /// <summary>The day it arrived — date only, and supplied by the caller so a delivery entered late keeps the day it happened.</summary>
    public DateOnly ReceivedOn { get; private set; }

    public string? SupplierName { get; private set; }

    /// <summary>The supplier's bill or invoice reference, so a receipt can be matched to paperwork.</summary>
    public string? InvoiceNumber { get; private set; }

    /// <summary>What the shop paid per unit on this delivery. Null when the bill has not arrived yet.</summary>
    public decimal? RatePerUnit { get; private set; }

    public string? Notes { get; private set; }

    /// <summary>Computed, never stored: a total that could disagree with its own parts is worse than no total.</summary>
    public decimal? TotalCost => RatePerUnit is { } rate ? Quantity * rate : null;

    private ClothReceipt()
    {
        // Reserved for EF Core materialization.
    }

    private ClothReceipt(Guid id)
        : base(id)
    {
    }

    public static ClothReceipt Create(
        Guid clothPriceId,
        string clothCode,
        string clothName,
        decimal quantity,
        ClothUnit unit,
        DateOnly receivedOn,
        string? supplierName,
        string? invoiceNumber,
        decimal? ratePerUnit,
        string? notes)
    {
        var receipt = new ClothReceipt(Guid.NewGuid())
        {
            ClothPriceId = Guard.AgainstEmpty(clothPriceId, nameof(clothPriceId)),
            ClothCode = Guard.AgainstNullOrWhiteSpace(clothCode, nameof(clothCode)).Trim(),
            ClothName = Guard.AgainstNullOrWhiteSpace(clothName, nameof(clothName)).Trim(),
            Quantity = Guard.AgainstNegativeOrZero(quantity, nameof(quantity)),
            Unit = unit,
            ReceivedOn = receivedOn,
            SupplierName = Blank(supplierName),
            InvoiceNumber = Blank(invoiceNumber),
            Notes = Blank(notes),
        };

        if (ratePerUnit is { } rate)
        {
            // Zero is a real rate — free samples happen — but a negative one is not.
            receipt.RatePerUnit = rate < 0
                ? throw new ArgumentOutOfRangeException(nameof(ratePerUnit), rate, "Rate cannot be negative.")
                : rate;
        }

        return receipt;
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
