namespace MathilensERP.Domain.Measurements;

/// <summary>
/// What a measurement point asks for.
///
/// <para>Points were numbers and nothing else, which suited a chest or an inseam but had no way to
/// record the things a tailor also needs on the job card: whether a trouser has a cross pocket,
/// what collar style a shirt is being made in. Those are a yes/no and a word, not a figure.</para>
///
/// <para>The order of these members is the stored form — they are written to the template as names,
/// not numbers, so adding one is safe and reordering them is harmless.</para>
/// </summary>
public enum MeasurementPointType
{
    /// <summary>A figure in centimetres, and what every point was before this existed.</summary>
    Number,

    /// <summary>A yes or no — a pocket, a pleat, a feature that is either on the garment or not.</summary>
    Checkbox,

    /// <summary>A word or two — a style name, a reference to a garment the customer brought in.</summary>
    Text,
}
