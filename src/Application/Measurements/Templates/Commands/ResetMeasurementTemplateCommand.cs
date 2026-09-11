using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Templates.Commands;

/// <summary>
/// Drops the shop's stored template for a garment type so it falls back to the built-in one.
/// Without this, a template edited into an unusable state could only be repaired by retyping the
/// original by hand.
/// </summary>
public sealed record ResetMeasurementTemplateCommand(string GarmentType) : ICommand<Result<MeasurementTemplateDto>>;
