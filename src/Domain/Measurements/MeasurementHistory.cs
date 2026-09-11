using System.Text.Json;
using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Measurements;

/// <summary>
/// An immutable historical snapshot of a customer's measurements at a point in time
/// (02_DATABASE.md § 10.5) — written automatically whenever a <see cref="Measurement"/> is
/// updated, never written directly by a user action, and never itself updated.
///
/// Not <see cref="ISoftDeletable"/>, matching the documented retention rule: historical
/// traceability is this entity's entire purpose, so it is retained independently of its
/// parent chain rather than following the soft-delete lifecycle of a business record.
/// </summary>
public sealed class MeasurementHistory : IAuditable
{
    public Guid Id { get; private set; }

    public Guid MeasurementId { get; private set; }

    // Seeded so the EF materialisation constructor leaves no null behind; every path that
    // creates one sets it. Free text since a shop names its own garments — see GarmentTypes.
    public string GarmentType { get; private set; } = string.Empty;

    public string ValuesJson { get; private set; } = "{}";

    public IReadOnlyDictionary<string, MeasurementValue> Values =>
        JsonSerializer.Deserialize<Dictionary<string, MeasurementValue>>(ValuesJson) ?? [];

    public DateTime CreatedAtUtc { get; private set; }

    public Guid CreatedBy { get; private set; }

    public DateTime? LastModifiedAtUtc { get; private set; }

    public Guid? LastModifiedBy { get; private set; }

    private MeasurementHistory()
    {
        // Reserved for EF Core materialization.
    }

    /// <summary>Captures the current values of <paramref name="measurement"/> as a snapshot, before it is updated.</summary>
    public static MeasurementHistory CaptureSnapshot(Measurement measurement)
    {
        Guard.AgainstNull(measurement, nameof(measurement));

        return new MeasurementHistory
        {
            Id = Guid.NewGuid(),
            MeasurementId = measurement.Id,
            GarmentType = measurement.GarmentType,
            ValuesJson = measurement.ValuesJson,
        };
    }

    public void SetCreationAudit(Guid createdBy, DateTime createdAtUtc)
    {
        CreatedBy = Guard.AgainstEmpty(createdBy, nameof(createdBy));
        CreatedAtUtc = createdAtUtc;
    }

    /// <summary>Never invoked in practice — a <see cref="MeasurementHistory"/> row is insert-only (02_DATABASE.md § 10.5 Validation Rules).</summary>
    public void SetModificationAudit(Guid modifiedBy, DateTime modifiedAtUtc)
    {
        LastModifiedBy = Guard.AgainstEmpty(modifiedBy, nameof(modifiedBy));
        LastModifiedAtUtc = modifiedAtUtc;
    }
}
