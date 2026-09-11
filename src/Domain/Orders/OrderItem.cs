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

    public decimal UnitPrice { get; private set; }

    public FabricDetails? Fabric { get; private set; }

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

    /// <summary>Sets (or replaces) this item's fabric details (02_DATABASE.md § 10.11).</summary>
    internal void SetFabric(
        string fabricType,
        FabricSource source,
        string? color,
        decimal quantity,
        Guid? clothPriceId = null,
        string? clothCode = null,
        ClothUnit unit = ClothUnit.Metres) =>
        Fabric = FabricDetails.Create(Id, fabricType, source, color, quantity, clothPriceId, clothCode, unit);
}
