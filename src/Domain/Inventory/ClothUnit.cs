namespace MathilensERP.Domain.Inventory;

/// <summary>
/// The unit a cloth receipt was measured in. A fixed set rather than free text, so two receipts
/// of the same cloth can be compared without anyone deciding whether "mtr" and "metre" agree.
/// </summary>
public enum ClothUnit
{
    Metres,
    Yards,
    Pieces,
    Rolls
}
