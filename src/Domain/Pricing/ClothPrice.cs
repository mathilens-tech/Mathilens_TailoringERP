using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Pricing;

/// <summary>
/// The shop's price list — one catalog entry per fabric roll/style reference ("cloth code"),
/// carrying both what the shop paid (<see cref="CostPrice"/>) and what it charges
/// (<see cref="SellingPrice"/>). Looked up by staff on the New Order screen so a garment
/// item's unit price can be filled in from <see cref="SellingPrice"/> instead of typed
/// freehand every time — <see cref="CostPrice"/> is for the shop's own margin tracking and
/// is never sent to a customer-facing order.
/// </summary>
public sealed class ClothPrice : AuditableEntity
{
    public string ClothCode { get; private set; } = string.Empty;

    public string ClothName { get; private set; } = string.Empty;

    public decimal CostPrice { get; private set; }

    public decimal SellingPrice { get; private set; }

    private ClothPrice()
    {
        // Reserved for EF Core materialization.
    }

    private ClothPrice(Guid id)
        : base(id)
    {
    }

    public static ClothPrice Create(string clothCode, string clothName, decimal costPrice, decimal sellingPrice)
    {
        var clothPrice = new ClothPrice(Guid.NewGuid());
        clothPrice.SetDetails(clothCode, clothName, costPrice, sellingPrice);
        return clothPrice;
    }

    public void UpdateDetails(string clothCode, string clothName, decimal costPrice, decimal sellingPrice) =>
        SetDetails(clothCode, clothName, costPrice, sellingPrice);

    private void SetDetails(string clothCode, string clothName, decimal costPrice, decimal sellingPrice)
    {
        ClothCode = Guard.AgainstNullOrWhiteSpace(clothCode, nameof(clothCode));
        ClothName = Guard.AgainstNullOrWhiteSpace(clothName, nameof(clothName));
        CostPrice = Guard.AgainstNegativeOrZero(costPrice, nameof(costPrice));
        SellingPrice = Guard.AgainstNegativeOrZero(sellingPrice, nameof(sellingPrice));
    }
}
