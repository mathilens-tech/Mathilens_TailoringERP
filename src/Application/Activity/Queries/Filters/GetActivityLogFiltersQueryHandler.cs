using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Activity.Queries.Filters;

public sealed class GetActivityLogFiltersQueryHandler : IQueryHandler<GetActivityLogFiltersQuery, Result<ActivityLogFiltersDto>>
{
    private readonly IActivityLogRepository _activityLogRepository;

    public GetActivityLogFiltersQueryHandler(IActivityLogRepository activityLogRepository)
    {
        _activityLogRepository = activityLogRepository;
    }

    public async Task<Result<ActivityLogFiltersDto>> Handle(GetActivityLogFiltersQuery query, CancellationToken cancellationToken)
    {
        var screens = await _activityLogRepository.ListScreensAsync(cancellationToken);
        var users = await _activityLogRepository.ListUsersAsync(cancellationToken);

        return Result.Success(new ActivityLogFiltersDto(
            screens,
            users.Select(u => new ActivityLogUserDto(u.UserId, u.UserName)).ToList()));
    }
}
