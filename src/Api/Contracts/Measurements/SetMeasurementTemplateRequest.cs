using MathilensERP.Application.Measurements.Templates;

namespace MathilensERP.Api.Contracts.Measurements;

/// <param name="Points">
/// The measurement points, in the order staff should be asked for them — each a name and the kind
/// of answer it takes (a figure, a tick, or a word).
/// </param>
public sealed record SetMeasurementTemplateRequest(IReadOnlyList<MeasurementPointDto> Points);
