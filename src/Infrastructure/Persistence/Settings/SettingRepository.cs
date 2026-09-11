using MathilensERP.Application.Settings;
using MathilensERP.Domain.Settings;
using MathilensERP.Shared.Pagination;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.Settings;

public class SettingRepository : ISettingRepository
{
    private readonly ApplicationDbContext _dbContext;

    public SettingRepository(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<Setting?> GetByKeyAsync(string key, CancellationToken cancellationToken) =>
        _dbContext.Settings.SingleOrDefaultAsync(s => s.Key == key, cancellationToken);

    public async Task<PagedResult<Setting>> ListAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        var query = _dbContext.Settings.AsQueryable();

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(s => s.Key)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Setting>(items, page, pageSize, totalCount);
    }

    public async Task<IReadOnlyList<Setting>> ListByKeyPrefixAsync(string keyPrefix, CancellationToken cancellationToken) =>
        await _dbContext.Settings
            .Where(s => s.Key.StartsWith(keyPrefix))
            .OrderBy(s => s.Key)
            .ToListAsync(cancellationToken);

    public void Add(Setting setting) => _dbContext.Settings.Add(setting);

    public void Remove(Setting setting) => _dbContext.Settings.Remove(setting);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);
}
