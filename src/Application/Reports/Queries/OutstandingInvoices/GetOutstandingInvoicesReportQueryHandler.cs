using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Reports.Queries.OutstandingInvoices;

public sealed class GetOutstandingInvoicesReportQueryHandler
    : IQueryHandler<GetOutstandingInvoicesReportQuery, Result<PagedResult<OutstandingInvoiceDto>>>
{
    private readonly IReportRepository _reportRepository;

    public GetOutstandingInvoicesReportQueryHandler(IReportRepository reportRepository)
    {
        _reportRepository = reportRepository;
    }

    public async Task<Result<PagedResult<OutstandingInvoiceDto>>> Handle(GetOutstandingInvoicesReportQuery query, CancellationToken cancellationToken)
    {
        var page = await _reportRepository.GetOutstandingInvoicesAsync(query.Page, query.PageSize, cancellationToken);

        return Result.Success(page);
    }
}
