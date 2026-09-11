using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Templates.Commands;

/// <summary>
/// Replaces one garment type's measurement points wholesale. The list is ordered: its order is
/// the order staff will be asked for the measurements in, which is the point of the screen.
/// </summary>
public sealed record SetMeasurementTemplateCommand(string GarmentType, IReadOnlyList<MeasurementPointDto> Points)
    : ICommand<Result<MeasurementTemplateDto>>;
