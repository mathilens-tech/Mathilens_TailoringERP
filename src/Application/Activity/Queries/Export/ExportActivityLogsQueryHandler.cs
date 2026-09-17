using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Activity.Queries.Export;

public sealed class ExportActivityLogsQueryHandler
    : IQueryHandler<ExportActivityLogsQuery, Result<IReadOnlyList<ActivityLogDto>>>
{
    /// <summary>
    /// Large enough for a shop's working history, while keeping a single download bounded. The same
    /// figure the order export uses — two different ceilings would only invite the question of why.
    /// </summary>
    private const int ExportPageSize = 5000;

    private readonly IActivityLogRepository _activityLogRepository;

    public ExportActivityLogsQueryHandler(IActivityLogRepository activityLogRepository)
    {
        _activityLogRepository = activityLogRepository;
    }

    public async Task<Result<IReadOnlyList<ActivityLogDto>>> Handle(
        ExportActivityLogsQuery query, CancellationToken cancellationToken)
    {
        // The repository already pages and already orders newest first; an export is that same
        // query with a bigger page, which is why this needs no method of its own on the port.
        var page = await _activityLogRepository.SearchAsync(
            query.FromUtc, query.ToUtc, query.UserId, query.Screen, 1, ExportPageSize, cancellationToken);

        return page.Items.Select(ActivityLogMapping.ToDto).ToList();
    }
}
