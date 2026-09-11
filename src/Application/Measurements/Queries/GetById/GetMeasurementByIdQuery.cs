using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Measurements;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Queries.GetById;

public sealed record GetMeasurementByIdQuery(Guid Id) : IQuery<Result<MeasurementDto>>;
