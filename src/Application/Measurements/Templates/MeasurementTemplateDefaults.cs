using MathilensERP.Domain.Measurements;

namespace MathilensERP.Application.Measurements.Templates;

/// <summary>
/// The measurement points a shop takes for each garment type, in the order the tailor calls them
/// out, before anyone has customised anything. Every recognised <see cref="GarmentType"/> has one
/// — previously only Shirt and Trousers did, so every other garment showed "no template
/// configured" and could not be measured at all.
///
/// These are starting points, not rules: a shop edits the list and the order per garment type
/// from Settings, and the stored template then wins (see <see cref="MeasurementTemplateKeys"/>).
/// Values are centimetres by shop convention, matching <see cref="Domain.Measurements.Measurement"/>.
/// </summary>
public static class MeasurementTemplateDefaults
{
    // Shorthands, purely so the table below stays readable: a garment's points are worth seeing as
    // a list, not as a column of MeasurementPointDto constructors.
    private static MeasurementPointDto N(string name) => new(name, MeasurementPointType.Number);

    private static MeasurementPointDto C(string name) => new(name, MeasurementPointType.Checkbox);

    private static MeasurementPointDto T(string name) => new(name, MeasurementPointType.Text);

    /// <summary>
    /// Shared, because the same garment goes by several names. A shop that added "Pant" rather than
    /// "Trousers" was getting an empty template and the message "No measurement points configured
    /// for Pant yet" — technically right, since nothing had been configured, but the standard
    /// points plainly existed and it was only the word that differed.
    /// </summary>
    private static readonly IReadOnlyList<MeasurementPointDto> TrouserPoints =
    [
        N("Waist"), N("Hip/Seat"), N("Thigh"), N("Knee"), N("Calf"),
        N("Inseam (inside leg)"), N("Outseam (waist to ankle)"), N("Rise (front & back)"),
        N("Bottom opening (ankle width)"),
        // Present or not, rather than measured — a tailor ticks these off the job card.
        C("Side pocket"), C("Cross pocket"), C("Back pocket"), C("Fleets"), C("TK Pocket"),
    ];

    // Case-insensitive: garment names are the shop's own text now, so "shirt" typed into the
    // garment master has to find the standard shirt points rather than starting blank.
    private static readonly IReadOnlyDictionary<string, IReadOnlyList<MeasurementPointDto>> ByGarmentType =
        new Dictionary<string, IReadOnlyList<MeasurementPointDto>>(StringComparer.OrdinalIgnoreCase)
        {
            [GarmentTypes.Shirt] =
            [
                N("Neck"), N("Shoulder width"), N("Chest"), N("Waist"), N("Hip"),
                N("Sleeve length"), N("Bicep"), N("Wrist"), N("Shirt length"),
                // How the shirt is being made, as against how big it is — a style name, not a
                // figure, so these take words.
                T("V.H Style"), T("D.B. Style"), T("Regular"), T("Pocket"), T("Arrow"), T("Floots"),
            ],
            [GarmentTypes.Trousers] = TrouserPoints,
            // The same points under the names a shop is likely to have typed. Aliases only, and
            // only for garments that would otherwise start blank — a shop that has saved its own
            // template for any of these still wins, since a stored template always beats a default.
            ["Pant"] = TrouserPoints,
            ["Pants"] = TrouserPoints,
            ["Trouser"] = TrouserPoints,
            [GarmentTypes.Suit] =
            [
                N("Neck"), N("Shoulder width"), N("Chest"), N("Waist"), N("Hip/Seat"),
                N("Sleeve length"), N("Bicep"), N("Cuff"), N("Back width"), N("Jacket length"),
                N("Trouser waist"), N("Thigh"), N("Inseam (inside leg)"), N("Outseam (waist to ankle)"),
                N("Bottom opening (ankle width)"),
            ],
            [GarmentTypes.Blazer] =
            [
                N("Neck"), N("Shoulder width"), N("Chest"), N("Waist"), N("Hip/Seat"),
                N("Sleeve length"), N("Bicep"), N("Cuff"), N("Back width"), N("Armhole"),
                N("Blazer length"), N("Lapel width"),
            ],
            [GarmentTypes.Kurta] =
            [
                N("Neck"), N("Shoulder width"), N("Chest"), N("Waist"), N("Hip"),
                N("Sleeve length"), N("Bicep"), N("Armhole"), N("Kurta length"), N("Bottom opening"),
            ],
            [GarmentTypes.Blouse] =
            [
                N("Neck depth (front)"), N("Neck depth (back)"), N("Shoulder width"), N("Bust/Chest"),
                N("Under-bust"), N("Waist"), N("Sleeve length"), N("Arm round"), N("Armhole"), N("Blouse length"),
            ],
            [GarmentTypes.Dress] =
            [
                N("Neck"), N("Shoulder width"), N("Bust/Chest"), N("Under-bust"), N("Waist"), N("Hip"),
                N("Sleeve length"), N("Arm round"), N("Armhole"), N("Shoulder to waist"),
                N("Waist to hem"), N("Full length"),
            ],
            // "Other" is whatever the shop is asked to make this once, so it starts generic on
            // purpose rather than guessing at a garment nobody named.
            [GarmentTypes.Other] = [N("Length"), N("Width"), N("Chest"), N("Waist"), N("Hip")],
        };

    /// <summary>
    /// The standard points for a garment, or none for one the shop invented.
    ///
    /// A garment this system never shipped — a Chudidhar, a Lehenga — has no standard anybody could
    /// have written down, so it starts empty and the shop fills the list in from the Measurement
    /// screen. Guessing at points for it would be worse than an empty list: nobody would know which
    /// of them were real.
    /// </summary>
    public static IReadOnlyList<MeasurementPointDto> For(string garmentType) =>
        ByGarmentType.TryGetValue(GarmentTypes.Normalise(garmentType), out var points) ? points : [];
}
