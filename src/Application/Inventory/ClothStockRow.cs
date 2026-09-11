using MathilensERP.Domain.Inventory;

namespace MathilensERP.Application.Inventory;

/// <summary>
/// One cloth-and-unit total straight from the database — the shape a GROUP BY returns, before the
/// handler folds the units of a single cloth into one line for the screen.
/// </summary>
/// <param name="Received">Total taken in against this cloth and unit.</param>
/// <param name="Used">
/// Total issued to orders: shop-supplied fabric on live (non-cancelled) orders. Customer-supplied
/// cloth was never the shop's, and a cancelled order releases what it had reserved.
/// </param>
public sealed record ClothStockRow(
    Guid ClothPriceId,
    string ClothCode,
    string ClothName,
    ClothUnit Unit,
    decimal Received,
    decimal Used,
    DateOnly? LastReceivedOn);
