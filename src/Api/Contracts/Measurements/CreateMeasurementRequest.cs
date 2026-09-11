using MathilensERP.Domain.Measurements;

namespace MathilensERP.Api.Contracts.Measurements;

/// <param name="Notes">Optional — what the numbers do not say about this fitting.</param>
public sealed record CreateMeasurementRequest(
    string GarmentType,
    IReadOnlyDictionary<string, MeasurementValue> Values,
    string? Notes = null);
