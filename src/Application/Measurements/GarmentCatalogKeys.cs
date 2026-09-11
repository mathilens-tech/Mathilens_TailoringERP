using MathilensERP.Application.Settings;
using MathilensERP.Domain.Measurements;

namespace MathilensERP.Application.Measurements;

/// <summary>
/// The garments this shop stitches, held in the shop-level setting store — one row per garment,
/// <c>Garment.Shirt</c> holding the name the shop calls it by.
///
/// <para>
/// A row per garment rather than one row holding a list: the Activity Log records a setting's
/// before-and-after value, so a rename reads as <c>Garment.Blouse, "Blouse" → "Saree Blouse"</c>
/// rather than as one JSON blob replacing another. It is the same shape the tailoring rates use.
/// </para>
/// <para>
/// A shop that has never opened the Garments screen has no rows at all, and gets
/// <see cref="GarmentTypes.WellKnown"/> — the list starts complete rather than empty, so orders can
/// be taken before anyone has configured anything.
/// </para>
/// </summary>
public static class GarmentCatalogKeys
{
    public const string Prefix = "Garment.";

    public static string For(string garmentType) => $"{Prefix}{GarmentTypes.Normalise(garmentType)}";

    /// <summary>
    /// The garment names this shop offers, or the shipped list where it has chosen none.
    ///
    /// The key holds the garment's identity and the value holds its display name; they differ once
    /// a shop renames one. The identity is what orders and measurements store, so that is what this
    /// returns.
    /// </summary>
    public static async Task<IReadOnlyList<string>> ListAsync(
        ISettingRepository settingRepository,
        CancellationToken cancellationToken)
    {
        var stored = await settingRepository.ListByKeyPrefixAsync(Prefix, cancellationToken);

        var names = stored
            .Select(setting => setting.Key[Prefix.Length..])
            .Where(GarmentTypes.IsWellFormed)
            .Select(GarmentTypes.Normalise)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return names.Count > 0 ? names : GarmentTypes.WellKnown;
    }
}
