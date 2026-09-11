namespace MathilensERP.Shared.Constants;

/// <summary>
/// Upper bounds on what an order may say, so a slipped keystroke cannot become a bill.
///
/// <para>These are not business rules about what a shop may sell — they are sanity limits. The
/// quantity field took any number at all, so "10" typed with a stuck key priced an order in the
/// millions and the mistake only showed up on the invoice.</para>
/// </summary>
public static class OrderLimits
{
    /// <summary>
    /// One lakh garments on a single line. Far past any real order a tailoring shop takes, which is
    /// the point: it is the wall a typo hits, not a limit anyone should ever reach.
    /// </summary>
    public const int MaxItemQuantity = 100_000;
}
