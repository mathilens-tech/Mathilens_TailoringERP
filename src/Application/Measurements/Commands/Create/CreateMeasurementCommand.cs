using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Measurements;
using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Commands.Create;

public sealed record CreateMeasurementCommand(
    Guid CustomerId,
    string GarmentType,
    IReadOnlyDictionary<string, MeasurementValue> Values,
    string? Notes = null) : ICommand<Result<MeasurementDto>>;
