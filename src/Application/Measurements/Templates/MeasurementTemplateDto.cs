using MathilensERP.Domain.Measurements;

namespace MathilensERP.Application.Measurements.Templates;

/// <summary>
/// One garment type's measurement points, in the order they should be shown and entered.
/// </summary>
/// <param name="IsCustomised">
/// False when the shop has never edited this garment type and is seeing the built-in starting
/// point — worth surfacing so the Settings screen can say so rather than implying someone chose it.
/// </param>
public sealed record MeasurementTemplateDto(string GarmentType, IReadOnlyList<MeasurementPointDto> Points, bool IsCustomised);
