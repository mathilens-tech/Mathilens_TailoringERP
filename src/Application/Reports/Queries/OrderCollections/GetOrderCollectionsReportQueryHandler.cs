using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Reports.Queries.OrderCollections;

public sealed class GetOrderCollectionsReportQueryHandler : IQueryHandler<GetOrderCollectionsReportQuery, Result<OrderCollectionsReportDto>>
{
    private readonly IReportRepository _reportRepository;

    public GetOrderCollectionsReportQueryHandler(IReportRepository reportRepository)
    {
        _reportRepository = reportRepository;
    }

    public async Task<Result<OrderCollectionsReportDto>> Handle(GetOrderCollectionsReportQuery query, CancellationToken cancellationToken)
    {
        var report = await _reportRepository.GetOrderCollectionsAsync(query.FromUtc, query.ToUtc, cancellationToken);

        return Result.Success(report);
    }
}
