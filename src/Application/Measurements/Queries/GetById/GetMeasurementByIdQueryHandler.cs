using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Measurements;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Queries.GetById;

public sealed class GetMeasurementByIdQueryHandler : IQueryHandler<GetMeasurementByIdQuery, Result<MeasurementDto>>
{
    private readonly IMeasurementRepository _measurementRepository;

    public GetMeasurementByIdQueryHandler(IMeasurementRepository measurementRepository)
    {
        _measurementRepository = measurementRepository;
    }

    public async Task<Result<MeasurementDto>> Handle(GetMeasurementByIdQuery query, CancellationToken cancellationToken)
    {
        var measurement = await _measurementRepository.GetByIdAsync(query.Id, cancellationToken);

        return measurement is null
            ? Result.Failure<MeasurementDto>(Error.NotFound("Measurement.NotFound", $"No measurement was found with id '{query.Id}'."))
            : measurement.ToDto();
    }
}
