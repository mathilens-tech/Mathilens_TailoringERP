using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Queries.Search;

/// <summary>Free-text search over <c>FullName</c>/<c>PhoneNumber</c>, narrowed by religion (00_MASTER_SPEC.md § 8.4 Filtering).</summary>
public sealed record SearchCustomersQuery(string? SearchTerm, Religion? Religion, int Page, int PageSize) : IQuery<Result<PagedResult<CustomerDto>>>;
