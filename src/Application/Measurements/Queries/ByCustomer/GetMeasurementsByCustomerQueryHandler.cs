using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Measurements;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Queries.ByCustomer;

public sealed class GetMeasurementsByCustomerQueryHandler : IQueryHandler<GetMeasurementsByCustomerQuery, Result<IReadOnlyList<MeasurementDto>>>
{
    private readonly IMeasurementRepository _measurementRepository;

    public GetMeasurementsByCustomerQueryHandler(IMeasurementRepository measurementRepository)
    {
        _measurementRepository = measurementRepository;
    }

    public async Task<Result<IReadOnlyList<MeasurementDto>>> Handle(GetMeasurementsByCustomerQuery query, CancellationToken cancellationToken)
    {
        var measurements = await _measurementRepository.GetByCustomerAsync(query.CustomerId, cancellationToken);

        IReadOnlyList<MeasurementDto> dtos = measurements.Select(m => m.ToDto()).ToList();

        return Result.Success(dtos);
    }
}
