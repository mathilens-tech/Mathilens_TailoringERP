using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Measurements;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Measurements.Queries.History;

public sealed class GetMeasurementHistoryQueryHandler : IQueryHandler<GetMeasurementHistoryQuery, Result<PagedResult<MeasurementHistoryDto>>>
{
    private readonly IMeasurementRepository _measurementRepository;

    public GetMeasurementHistoryQueryHandler(IMeasurementRepository measurementRepository)
    {
        _measurementRepository = measurementRepository;
    }

    public async Task<Result<PagedResult<MeasurementHistoryDto>>> Handle(GetMeasurementHistoryQuery query, CancellationToken cancellationToken)
    {
        var page = await _measurementRepository.GetHistoryAsync(query.MeasurementId, query.Page, query.PageSize, cancellationToken);

        var items = page.Items.Select(h => h.ToDto()).ToList();

        return new PagedResult<MeasurementHistoryDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
