using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Queries.Search;

public sealed class SearchCustomersQueryHandler : IQueryHandler<SearchCustomersQuery, Result<PagedResult<CustomerDto>>>
{
    private readonly ICustomerRepository _customerRepository;

    public SearchCustomersQueryHandler(ICustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }

    public async Task<Result<PagedResult<CustomerDto>>> Handle(SearchCustomersQuery query, CancellationToken cancellationToken)
    {
        var page = await _customerRepository.SearchAsync(query.SearchTerm, query.Religion, query.Page, query.PageSize, cancellationToken);

        var items = page.Items.Select(c => c.ToDto()).ToList();

        return new PagedResult<CustomerDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
