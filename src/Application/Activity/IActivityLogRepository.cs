using MathilensERP.Domain.Activity;
using MathilensERP.Shared.Pagination;

namespace MathilensERP.Application.Activity;

/// <summary>Repository port for the insert-only <see cref="ActivityLog"/> trail.</summary>
public interface IActivityLogRepository
{
    Task AddAsync(ActivityLog activityLog, CancellationToken cancellationToken);

    Task<PagedResult<ActivityLog>> SearchAsync(
        DateTime? fromUtc,
        DateTime? toUtc,
        Guid? userId,
        string? screen,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    /// <summary>The distinct screens present in the log, for the filter dropdown — so it only ever offers values that exist.</summary>
    Task<IReadOnlyList<string>> ListScreensAsync(CancellationToken cancellationToken);

    /// <summary>The distinct users present in the log, for the filter dropdown.</summary>
    Task<IReadOnlyList<(Guid UserId, string UserName)>> ListUsersAsync(CancellationToken cancellationToken);
}
