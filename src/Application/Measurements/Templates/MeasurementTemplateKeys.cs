using MathilensERP.Domain.Measurements;

namespace MathilensERP.Application.Measurements.Templates;

/// <summary>
/// Templates live in the shop-level <see cref="Domain.Settings.Setting"/> key/value store — one
/// row per garment type, holding a JSON array of point names in display order. A separate table
/// would buy nothing here: this is exactly the "shop-level configuration" that store exists for
/// (02_DATABASE.md § 10.12), and it needs no migration to add a garment type.
///
/// They are *read* through the Measurements module rather than the Settings module because front
/// desk and tailor staff take measurements but deliberately hold no Settings permission
/// (<see cref="Shared.Authorization.AppRoles"/>) — reading the shop's template must not require
/// permission to administer the shop.
/// </summary>
public static class MeasurementTemplateKeys
{
    public const string Prefix = "Measurements.Template.";

    /// <summary>
    /// Normalised, so a garment typed with a stray space cannot claim a second template key and
    /// leave the shop's edits apparently unsaved.
    /// </summary>
    public static string For(string garmentType) => $"{Prefix}{GarmentTypes.Normalise(garmentType)}";
}
