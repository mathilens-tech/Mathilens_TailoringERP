using MathilensERP.Application.Activity;
using MathilensERP.Domain.Activity;
using MathilensERP.Shared.Pagination;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.Activity;

public class ActivityLogRepository : IActivityLogRepository
{
    private readonly ApplicationDbContext _dbContext;

    public ActivityLogRepository(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Saves immediately rather than joining the command's own commit. The command has already
    /// been saved by its handler by this point, so there is no shared transaction left to enlist
    /// in — and an audit write must not be able to roll back work that already succeeded.
    /// </summary>
    public async Task AddAsync(ActivityLog activityLog, CancellationToken cancellationToken)
    {
        _dbContext.ActivityLogs.Add(activityLog);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<PagedResult<ActivityLog>> SearchAsync(
        DateTime? fromUtc,
        DateTime? toUtc,
        Guid? userId,
        string? screen,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.ActivityLogs.AsQueryable();

        if (fromUtc is { } from)
        {
            query = query.Where(a => a.OccurredAtUtc >= from);
        }

        if (toUtc is { } to)
        {
            query = query.Where(a => a.OccurredAtUtc <= to);
        }

        if (userId is { } id)
        {
            query = query.Where(a => a.UserId == id);
        }

        if (!string.IsNullOrWhiteSpace(screen))
        {
            query = query.Where(a => a.Screen == screen);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(a => a.OccurredAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<ActivityLog>(items, page, pageSize, totalCount);
    }

    public async Task<IReadOnlyList<string>> ListScreensAsync(CancellationToken cancellationToken) =>
        await _dbContext.ActivityLogs
            .Select(a => a.Screen)
            .Distinct()
            .OrderBy(screen => screen)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<(Guid UserId, string UserName)>> ListUsersAsync(CancellationToken cancellationToken)
    {
        var users = await _dbContext.ActivityLogs
            .Where(a => a.UserId != null && a.UserName != null)
            .Select(a => new { UserId = a.UserId!.Value, UserName = a.UserName! })
            .Distinct()
            .OrderBy(u => u.UserName)
            .ToListAsync(cancellationToken);

        // A user renamed partway through leaves two rows for one id; the most recent name wins.
        return users
            .GroupBy(u => u.UserId)
            .Select(g => (g.Key, g.Last().UserName))
            .ToList();
    }
}
