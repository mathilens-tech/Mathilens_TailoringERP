using System.Text.Json;
using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Measurements;

/// <summary>
/// The current, active set of measurements for a customer for a given garment type
/// (02_DATABASE.md § 10.4) — "the latest known truth" staff reference when creating orders.
///
/// Measurement points are a flexible name/value set (persisted as JSON) rather than fixed
/// per-garment-type columns: 02_DATABASE.md § 10.4 Future Expansion explicitly scopes
/// "garment-type-specific measurement templates" as future work, so a rigid Version 1 schema
/// per garment type would be exactly the speculative complexity YAGNI (00_MASTER_SPEC.md § 4.5)
/// rules out. Values are centimeters by shop convention; a per-record unit is future work.
/// </summary>
public sealed class Measurement : AuditableEntity
{
    public Guid CustomerId { get; private set; }

    // Seeded so the EF materialisation constructor leaves no null behind; every path that
    // creates one sets it. Free text since a shop names its own garments — see GarmentTypes.
    public string GarmentType { get; private set; } = string.Empty;

    /// <summary>Persisted form of <see cref="Values"/> — an ordinary JSON-text column, not a
    /// provider-specific JSON column type, to keep the mapping simple and dependable.</summary>
    public string ValuesJson { get; private set; } = "{}";

    public IReadOnlyDictionary<string, MeasurementValue> Values =>
        JsonSerializer.Deserialize<Dictionary<string, MeasurementValue>>(ValuesJson) ?? [];

    /// <summary>
    /// What the numbers do not say — "left shoulder sits lower", "customer wants it loose at the
    /// waist", "cuff as per the shirt he brought in".
    ///
    /// <para>Per measurement set, so it belongs to this customer and this garment and follows them
    /// onto every future order for it, which is exactly where a fitting note is wanted the second
    /// time. Optional: most measurements have nothing to add.</para>
    /// </summary>
    public string? Notes { get; private set; }

    private Measurement()
    {
        // Reserved for EF Core materialization.
    }

    private Measurement(Guid id)
        : base(id)
    {
    }

    public static Measurement Create(
        Guid customerId,
        string garmentType,
        IReadOnlyDictionary<string, MeasurementValue> values,
        string? notes = null)
    {
        var measurement = new Measurement(Guid.NewGuid())
        {
            CustomerId = Guard.AgainstEmpty(customerId, nameof(customerId)),
            // Normalised on the way in, so one customer cannot end up with two measurement sets for
            // what is really the same garment.
            GarmentType = GarmentTypes.Normalise(garmentType),
        };

        measurement.SetValues(values);
        measurement.SetNotes(notes);

        return measurement;
    }

    public void UpdateValues(IReadOnlyDictionary<string, MeasurementValue> values) => SetValues(values);

    /// <summary>
    /// Replaces the note. Separate from <see cref="UpdateValues"/> because the two are edited
    /// together on one screen but mean different things: re-measuring a customer is a fact
    /// changing, and rewriting the note is a remark changing.
    /// </summary>
    public void UpdateNotes(string? notes) => SetNotes(notes);

    private void SetNotes(string? notes) =>
        // Blank and whitespace collapse to null, so "no note" is one value in the column rather
        // than three that every reader would have to test for.
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();

    private void SetValues(IReadOnlyDictionary<string, MeasurementValue> values)
    {
        Guard.AgainstNull(values, nameof(values));

        if (values.Count == 0)
        {
            throw new ArgumentException("At least one measurement value is required.", nameof(values));
        }

        foreach (var (point, value) in values)
        {
            Guard.AgainstNullOrWhiteSpace(point, nameof(values));

            // Validated by what the value means rather than uniformly. A chest of zero is a point
            // nobody measured; a checkbox of "no" and an empty style are perfectly good answers,
            // and the old blanket AgainstNegativeOrZero would have refused both.
            switch (value.Kind)
            {
                case MeasurementPointType.Number:
                    Guard.AgainstNegativeOrZero(value.Number, nameof(values));
                    break;
                case MeasurementPointType.Text:
                    Guard.AgainstNull(value.Text, nameof(values));
                    break;
            }
        }

        ValuesJson = JsonSerializer.Serialize(values);
    }
}
