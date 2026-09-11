using System.Text.Json;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Activity.Queries.Search;

public sealed class SearchActivityLogsQueryHandler : IQueryHandler<SearchActivityLogsQuery, Result<PagedResult<ActivityLogDto>>>
{
    private static readonly JsonSerializerOptions ChangeJson = new(JsonSerializerDefaults.Web);

    private readonly IActivityLogRepository _activityLogRepository;

    public SearchActivityLogsQueryHandler(IActivityLogRepository activityLogRepository)
    {
        _activityLogRepository = activityLogRepository;
    }

    public async Task<Result<PagedResult<ActivityLogDto>>> Handle(SearchActivityLogsQuery query, CancellationToken cancellationToken)
    {
        var page = await _activityLogRepository.SearchAsync(
            query.FromUtc, query.ToUtc, query.UserId, query.Screen, query.Page, query.PageSize, cancellationToken);

        var items = page.Items
            .Select(a => new ActivityLogDto(
                a.Id, a.UserId, a.UserName, a.Screen, a.Action, a.RequestName, a.Description, ReadChanges(a.Changes), a.OccurredAtUtc))
            .ToList();

        return new PagedResult<ActivityLogDto>(items, page.Page, page.PageSize, page.TotalCount);
    }

    /// <summary>
    /// A row whose JSON cannot be read still has a date, a user and an action worth showing, so an
    /// unreadable value costs that one entry its detail rather than costing the caller the page.
    /// </summary>
    private static IReadOnlyList<ActivityChangeDto> ReadChanges(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<ActivityChangeDto>>(json, ChangeJson) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
