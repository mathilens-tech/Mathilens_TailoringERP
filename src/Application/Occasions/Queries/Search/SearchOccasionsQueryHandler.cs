using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Occasions.Queries.Search;

public sealed class SearchOccasionsQueryHandler
    : IQueryHandler<SearchOccasionsQuery, Result<PagedResult<OccasionRowDto>>>
{
    private readonly IOccasionRepository _occasions;

    public SearchOccasionsQueryHandler(IOccasionRepository occasions)
    {
        _occasions = occasions;
    }

    public async Task<Result<PagedResult<OccasionRowDto>>> Handle(SearchOccasionsQuery query, CancellationToken cancellationToken)
    {
        var result = await _occasions.SearchAsync(
            query.Occasion,
            query.Scope,
            query.WindowDays,
            query.Page,
            query.PageSize,
            cancellationToken);

        return Result.Success(result);
    }
}
