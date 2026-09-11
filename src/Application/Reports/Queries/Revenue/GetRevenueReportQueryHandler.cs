using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Reports.Queries.Revenue;

public sealed class GetRevenueReportQueryHandler : IQueryHandler<GetRevenueReportQuery, Result<RevenueReportDto>>
{
    private readonly IReportRepository _reportRepository;

    public GetRevenueReportQueryHandler(IReportRepository reportRepository)
    {
        _reportRepository = reportRepository;
    }

    public async Task<Result<RevenueReportDto>> Handle(GetRevenueReportQuery query, CancellationToken cancellationToken)
    {
        var report = await _reportRepository.GetRevenueAsync(query.FromUtc, query.ToUtc, cancellationToken);

        return Result.Success(report);
    }
}
