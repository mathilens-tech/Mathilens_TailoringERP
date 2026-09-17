using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Activity.Queries.Search;

public sealed class SearchActivityLogsQueryHandler : IQueryHandler<SearchActivityLogsQuery, Result<PagedResult<ActivityLogDto>>>
{
    private readonly IActivityLogRepository _activityLogRepository;

    public SearchActivityLogsQueryHandler(IActivityLogRepository activityLogRepository)
    {
        _activityLogRepository = activityLogRepository;
    }

    public async Task<Result<PagedResult<ActivityLogDto>>> Handle(SearchActivityLogsQuery query, CancellationToken cancellationToken)
    {
        var page = await _activityLogRepository.SearchAsync(
            query.FromUtc, query.ToUtc, query.UserId, query.Screen, query.Page, query.PageSize, cancellationToken);

        // Mapping lives in ActivityLogMapping so the export renders an entry exactly as this does.
        var items = page.Items.Select(ActivityLogMapping.ToDto).ToList();

        return new PagedResult<ActivityLogDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
