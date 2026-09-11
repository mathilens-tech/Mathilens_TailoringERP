using MathilensERP.Domain.Measurements;
namespace MathilensERP.Api.Contracts.Measurements;

/// <param name="Notes">Optional — sent on every save, so omitting it clears the note.</param>
public sealed record UpdateMeasurementValuesRequest(
    IReadOnlyDictionary<string, MeasurementValue> Values,
    string? Notes = null);
