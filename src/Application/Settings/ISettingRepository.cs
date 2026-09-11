using MathilensERP.Domain.Settings;
using MathilensERP.Shared.Pagination;

namespace MathilensERP.Application.Settings;

/// <summary>Repository port for <see cref="Setting"/> (01_ARCHITECTURE.md § 25.1 Repository Pattern) — keyed by <see cref="Setting.Key"/>, its natural identifier.</summary>
public interface ISettingRepository
{
    Task<Setting?> GetByKeyAsync(string key, CancellationToken cancellationToken);

    Task<PagedResult<Setting>> ListAsync(int page, int pageSize, CancellationToken cancellationToken);

    /// <summary>
    /// Every setting whose key starts with <paramref name="keyPrefix"/>, unpaginated — for the
    /// small, bounded families of related keys some modules store (one row per garment type, and
    /// so on), which are read together and would otherwise cost one round trip each.
    /// </summary>
    Task<IReadOnlyList<Setting>> ListByKeyPrefixAsync(string keyPrefix, CancellationToken cancellationToken);

    void Add(Setting setting);

    void Remove(Setting setting);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
