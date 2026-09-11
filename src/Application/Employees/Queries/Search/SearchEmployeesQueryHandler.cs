using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Employees;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Queries.Search;

public sealed class SearchEmployeesQueryHandler : IQueryHandler<SearchEmployeesQuery, Result<PagedResult<EmployeeDto>>>
{
    private readonly IEmployeeRepository _employeeRepository;

    public SearchEmployeesQueryHandler(IEmployeeRepository employeeRepository)
    {
        _employeeRepository = employeeRepository;
    }

    public async Task<Result<PagedResult<EmployeeDto>>> Handle(SearchEmployeesQuery query, CancellationToken cancellationToken)
    {
        var page = await _employeeRepository.SearchAsync(query.SearchTerm, query.Page, query.PageSize, cancellationToken);

        var items = page.Items.Select(e => e.ToDto()).ToList();

        return new PagedResult<EmployeeDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
