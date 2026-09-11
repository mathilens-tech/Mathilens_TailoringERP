using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Reports.Queries.OrderStatusSummary;

public sealed class GetOrderStatusSummaryReportQueryHandler : IQueryHandler<GetOrderStatusSummaryReportQuery, Result<OrderStatusSummaryReportDto>>
{
    private readonly IReportRepository _reportRepository;

    public GetOrderStatusSummaryReportQueryHandler(IReportRepository reportRepository)
    {
        _reportRepository = reportRepository;
    }

    public async Task<Result<OrderStatusSummaryReportDto>> Handle(GetOrderStatusSummaryReportQuery query, CancellationToken cancellationToken)
    {
        var statusCounts = await _reportRepository.GetOrderStatusSummaryAsync(query.FromUtc, query.ToUtc, cancellationToken);

        return new OrderStatusSummaryReportDto(query.FromUtc, query.ToUtc, statusCounts);
    }
}
