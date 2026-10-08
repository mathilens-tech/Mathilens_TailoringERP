using MathilensERP.Domain.Common;
using MathilensERP.Domain.Inventory;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Orders;

/// <summary>
/// The fabric/material details for one <see cref="OrderItem"/> (02_DATABASE.md § 10.11) —
/// what fabric was used, and whether it was customer- or shop-supplied. Only ever created or
/// replaced through its owning <see cref="OrderItem"/>, never independently.
/// </summary>
public sealed class FabricDetails : AuditableEntity
{
    public Guid OrderItemId { get; private set; }

    public string FabricType { get; private set; } = string.Empty;

    public FabricSource Source { get; private set; }

    public string? Color { get; private set; }

    public decimal Quantity { get; private set; }

    /// <summary>
    /// What a metre of this cloth is charged at on this order, so a garment cut from several cloths
    /// can bill each at its own rate — see <see cref="OrderItem.ClothAmount"/>.
    ///
    /// <para>Zero on every fabric written before this field existed: those orders folded the cloth
    /// charge into the item's <see cref="OrderItem.UnitPrice"/> instead, and there is no split to
    /// recover, so their cloth amount computes to zero and their totals are unchanged. A rate of
    /// zero is therefore "not billed separately", not "free".</para>
    /// </summary>
    public decimal RatePerMetre { get; private set; }

    /// <summary>
    /// The price-list entry this fabric came off, when the cloth code staff typed matches one.
    /// Null when it does not — the field has always accepted any text, and an order must not be
    /// refused because the shop has not catalogued a remnant yet.
    ///
    /// This is what lets stock fall: cloth issued against a catalogued code is netted off what was
    /// received. Fabric with no match, or supplied by the customer, touches no stock.
    /// </summary>
    public Guid? ClothPriceId { get; private set; }

    /// <summary>What staff typed as the cloth code, kept verbatim even when it matched nothing.</summary>
    public string? ClothCode { get; private set; }

    /// <summary>
    /// The unit <see cref="Quantity"/> is measured in. Stock is compared per unit — subtracting
    /// metres from rolls would produce a number that is true of neither.
    /// </summary>
    public ClothUnit Unit { get; private set; }

    private FabricDetails()
    {
        // Reserved for EF Core materialization.
    }

    private FabricDetails(Guid id)
        : base(id)
    {
    }

    internal static FabricDetails Create(
        Guid orderItemId,
        string fabricType,
        FabricSource source,
        string? color,
        decimal quantity,
        decimal ratePerMetre = 0m,
        Guid? clothPriceId = null,
        string? clothCode = null,
        ClothUnit unit = ClothUnit.Metres)
    {
        var fabric = new FabricDetails(Guid.NewGuid())
        {
            OrderItemId = Guard.AgainstEmpty(orderItemId, nameof(orderItemId)),
            FabricType = Guard.AgainstNullOrWhiteSpace(fabricType, nameof(fabricType)),
            Source = source,
            Color = color,
            Quantity = Guard.AgainstNegativeOrZero(quantity, nameof(quantity)),
            // Not AgainstNegativeOrZero: a rate of zero is the legacy "folded into unit price" case
            // and a valid value, not a mistake. Negative is the only thing to refuse.
            RatePerMetre = Guard.AgainstNegative(ratePerMetre, nameof(ratePerMetre)),
            ClothPriceId = clothPriceId,
            ClothCode = string.IsNullOrWhiteSpace(clothCode) ? null : clothCode.Trim(),
            Unit = unit,
        };

        return fabric;
    }
}
