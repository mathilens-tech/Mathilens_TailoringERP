namespace MathilensERP.Shared.Constants;

/// <summary>
/// Keys into the shop's generic settings store that the server itself reads.
///
/// Most settings are written by a screen and read back by that same screen, so their keys live in
/// the frontend only. These are the exceptions — named here because a typo in one would not fail a
/// build, it would silently fall back to a default and nobody would notice until the wrong value
/// reached a customer.
/// </summary>
public static class SettingKeys
{
    /// <summary>
    /// What every order number starts with, before the running count — "MTL" gives "MTL-0001".
    /// Set on Settings → Order Number.
    /// </summary>
    public const string OrderNumberPrefix = "Orders.NumberPrefix";

    /// <summary>
    /// What every invoice number starts with, before the year and the running count — "INV" gives
    /// "INV-2026-0001". Set on Settings → Invoice Settings.
    /// </summary>
    public const string InvoiceNumberPrefix = "Invoice.NumberPrefix";
}
