using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Billing.Queries.Search;

public sealed class SearchInvoicesQueryHandler : IQueryHandler<SearchInvoicesQuery, Result<PagedResult<InvoiceDto>>>
{
    private readonly IInvoiceRepository _invoiceRepository;

    public SearchInvoicesQueryHandler(IInvoiceRepository invoiceRepository)
    {
        _invoiceRepository = invoiceRepository;
    }

    public async Task<Result<PagedResult<InvoiceDto>>> Handle(SearchInvoicesQuery query, CancellationToken cancellationToken)
    {
        var page = await _invoiceRepository.SearchAsync(
            query.CustomerId, query.Status, query.FromUtc, query.ToUtc, query.Page, query.PageSize, cancellationToken);

        var items = page.Items.Select(i => i.ToDto()).ToList();

        return new PagedResult<InvoiceDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
