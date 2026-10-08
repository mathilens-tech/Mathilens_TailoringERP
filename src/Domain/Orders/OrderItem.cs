using MathilensERP.Domain.Common;
using MathilensERP.Domain.Inventory;
using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Orders;

/// <summary>
/// A single garment line item within an <see cref="Order"/> (02_DATABASE.md § 10.8). Only
/// ever created or modified through its owning <see cref="Order"/>, never independently.
/// </summary>
public sealed class OrderItem : AuditableEntity
{
    public Guid OrderId { get; private set; }

    // Seeded so the EF materialisation constructor leaves no null behind; every path that
    // creates one sets it. Free text since a shop names its own garments — see GarmentTypes.
    public string GarmentType { get; private set; } = string.Empty;

    public int Quantity { get; private set; }

    /// <summary>
    /// What one of this garment is charged for. On a row created since cloth became multi-valued
    /// this is the stitching alone — the cloth is billed separately through <see cref="Fabrics"/>
    /// and <see cref="ClothAmount"/>. On a row from before that, it still carries stitching plus
    /// cloth folded together, because that split was never recorded and cannot be recovered; such
    /// rows have no rated fabric, so <see cref="ClothAmount"/> is zero and the total is unchanged.
    /// A report wanting stitching alone must read <see cref="LineTotal"/> − <see cref="ClothAmount"/>.
    /// </summary>
    public decimal UnitPrice { get; private set; }

    // A garment can be cut from several cloths — 16 shirts from 5 bolts — so fabric is a collection,
    // not a single value. Private list, exposed read-only; mutated only through AddFabric/RemoveFabric
    // below, which are reachable only through the owning Order. An item created before this held at
    // most one, which is simply a list of length one or zero here.
    private readonly List<FabricDetails> _fabrics = [];

    public IReadOnlyList<FabricDetails> Fabrics => _fabrics;

    /// <summary>
    /// What this line's cloth comes to: each fabric's length times its own rate, summed. Zero for a
    /// customer's own cloth and for legacy rows whose rate was never split out (see
    /// <see cref="UnitPrice"/>).
    /// </summary>
    public decimal ClothAmount => _fabrics.Sum(f => f.Quantity * f.RatePerMetre);

    /// <summary>What this whole line is worth: the stitching, times how many, plus the cloth.</summary>
    public decimal LineTotal => Quantity * UnitPrice + ClothAmount;

    private OrderItem()
    {
        // Reserved for EF Core materialization.
    }

    private OrderItem(Guid id)
        : base(id)
    {
    }

    internal static OrderItem Create(Guid orderId, string garmentType, int quantity, decimal unitPrice)
    {
        var item = new OrderItem(Guid.NewGuid())
        {
            OrderId = Guard.AgainstEmpty(orderId, nameof(orderId)),
        };

        item.UpdateDetails(garmentType, quantity, unitPrice);
        return item;
    }

    /// <summary>Corrects this item's garment, quantity and price. Fabric details are unaffected.</summary>
    internal void UpdateDetails(string garmentType, int quantity, decimal unitPrice)
    {
        if (quantity <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(quantity), quantity, "Quantity must be greater than zero.");
        }

        // Normalised on the way in, so the same garment typed with a stray space cannot appear as
        // two lines on a report that groups by it.
        GarmentType = GarmentTypes.Normalise(garmentType);
        Quantity = quantity;
        UnitPrice = Guard.AgainstNegativeOrZero(unitPrice, nameof(unitPrice));
    }

    /// <summary>Adds one cloth to this item (02_DATABASE.md § 10.11). Returns it so the caller can
    /// name the id — a garment cut from several cloths adds this once per cloth.</summary>
    internal FabricDetails AddFabric(
        string fabricType,
        FabricSource source,
        string? color,
        decimal quantity,
        decimal ratePerMetre = 0m,
        Guid? clothPriceId = null,
        string? clothCode = null,
        ClothUnit unit = ClothUnit.Metres)
    {
        var fabric = FabricDetails.Create(Id, fabricType, source, color, quantity, ratePerMetre, clothPriceId, clothCode, unit);
        _fabrics.Add(fabric);
        return fabric;
    }

    /// <summary>Drops one cloth from this item by its id. A no-op if it is not on this item, so a
    /// double-submit of the same remove does not throw.</summary>
    internal void RemoveFabric(Guid fabricId)
    {
        var fabric = _fabrics.SingleOrDefault(f => f.Id == fabricId);
        if (fabric is not null)
        {
            _fabrics.Remove(fabric);
        }
    }

    /// <summary>Drops every cloth from this item — used when replacing the whole set in one edit.</summary>
    internal void ClearFabrics() => _fabrics.Clear();
}
