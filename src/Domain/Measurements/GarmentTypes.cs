namespace MathilensERP.Domain.Measurements;

/// <summary>
/// A garment type is the shop's own word for something it stitches — "Shirt", "Saree", "Chudidhar"
/// — held as text rather than as a fixed enum.
///
/// <para>
/// It was an enum of eight values, on the reasoning that an order could then never name a garment
/// nobody recognised (02_DATABASE.md § 10.4). That held the shop to eight garments it did not
/// choose: a tailor stitching chudidhars and lehengas had nowhere to put them, and no screen could
/// add one. The list a shop stitches is shop configuration, not a fact about tailoring.
/// </para>
/// <para>
/// Nothing changes in the database. The column was always <c>character varying(50)</c> holding the
/// enum's name, so rows written before this read back unchanged.
/// </para>
/// <para>
/// "Recognised" is now enforced at the boundary instead of by the type: see
/// <see cref="IsWellFormed"/>, which every command validator applies. What the shop actually offers
/// is its garment list in the settings store, which the New Order screen reads.
/// </para>
/// </summary>
public static class GarmentTypes
{
    /// <summary>Matches the column width — see the EF configurations for Measurements and OrderItems.</summary>
    public const int MaxLength = 50;

    public const string Shirt = "Shirt";
    public const string Trousers = "Trousers";
    public const string Suit = "Suit";
    public const string Blazer = "Blazer";
    public const string Kurta = "Kurta";
    public const string Blouse = "Blouse";
    public const string Dress = "Dress";
    public const string Other = "Other";

    /// <summary>
    /// The garments this system shipped with, and the ones <see cref="MeasurementTemplateDefaults"/>
    /// still carries standard points for. A shop is not limited to these — they are the starting
    /// list, not the permitted set.
    /// </summary>
    public static readonly IReadOnlyList<string> WellKnown =
        [Shirt, Trousers, Suit, Blazer, Kurta, Blouse, Dress, Other];

    /// <summary>
    /// Trimmed and collapsed, so " Saree  Blouse " and "Saree Blouse" cannot become two garments
    /// that look identical on screen and sort apart in a report.
    /// </summary>
    public static string Normalise(string? name) =>
        string.IsNullOrWhiteSpace(name) ? string.Empty : string.Join(' ', name.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));

    /// <summary>
    /// Storable as a garment name: present, within the column, and free of the control characters
    /// that would make it unreadable on an invoice.
    /// </summary>
    public static bool IsWellFormed(string? name)
    {
        var normalised = Normalise(name);
        return normalised.Length > 0
            && normalised.Length <= MaxLength
            && !normalised.Any(char.IsControl);
    }
}
