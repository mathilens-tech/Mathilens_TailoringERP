using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Templates.Queries;

/// <summary>Every garment type's measurement template — the shop's own where it has set one, the built-in starting point otherwise.</summary>
public sealed record GetMeasurementTemplatesQuery : IQuery<Result<IReadOnlyList<MeasurementTemplateDto>>>;
