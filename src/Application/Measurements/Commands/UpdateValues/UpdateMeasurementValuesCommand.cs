using MathilensERP.Domain.Measurements;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Measurements;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Commands.UpdateValues;

public sealed record UpdateMeasurementValuesCommand(
    Guid Id,
    IReadOnlyDictionary<string, MeasurementValue> Values,
    string? Notes = null) : ICommand<Result<MeasurementDto>>;
