using MathilensERP.Domain.Measurements;

namespace MathilensERP.Application.Measurements;

public sealed record MeasurementDto(
    Guid Id,
    Guid CustomerId,
    string GarmentType,
    IReadOnlyDictionary<string, MeasurementValue> Values,
    /// <summary>What the numbers do not say, or null when the tailor had nothing to add.</summary>
    string? Notes,
    DateTime CreatedAtUtc);

public sealed record MeasurementHistoryDto(
    Guid Id,
    Guid MeasurementId,
    string GarmentType,
    IReadOnlyDictionary<string, MeasurementValue> Values,
    DateTime CreatedAtUtc);
