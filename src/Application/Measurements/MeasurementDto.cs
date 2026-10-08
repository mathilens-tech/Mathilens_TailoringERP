using MathilensERP.Domain.Measurements;

namespace MathilensERP.Application.Measurements;

public sealed record MeasurementDto(
    Guid Id,
    Guid CustomerId,
    string GarmentType,
    IReadOnlyDictionary<string, MeasurementValue> Values,
    /// <summary>What the numbers do not say, or null when the tailor had nothing to add.</summary>
    string? Notes,
    DateTime CreatedAtUtc,
    /// <summary>When the figure was last re-measured, or null if it has not changed since it was
    /// first recorded. The screen reads "last updated" from this, falling back to
    /// <see cref="CreatedAtUtc"/> — a measurement never edited was last set when it was created.</summary>
    DateTime? LastModifiedAtUtc);

public sealed record MeasurementHistoryDto(
    Guid Id,
    Guid MeasurementId,
    string GarmentType,
    IReadOnlyDictionary<string, MeasurementValue> Values,
    DateTime CreatedAtUtc);
