using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Queries.Search;

/// <summary>Free-text search over <c>FullName</c>/<c>PhoneNumber</c> (00_MASTER_SPEC.md § 8.4 Filtering).</summary>
public sealed record SearchEmployeesQuery(string? SearchTerm, int Page, int PageSize) : IQuery<Result<PagedResult<EmployeeDto>>>;
