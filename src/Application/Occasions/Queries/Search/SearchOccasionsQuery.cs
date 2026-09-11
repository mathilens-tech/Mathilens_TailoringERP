using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Occasions.Queries.Search;

public sealed record SearchOccasionsQuery(
    OccasionType Occasion,
    OccasionScope Scope,
    int WindowDays,
    int Page,
    int PageSize) : IQuery<Result<PagedResult<OccasionRowDto>>>;
