using MathilensERP.Domain.Pricing;
using MathilensERP.Shared.Pagination;

namespace MathilensERP.Application.Pricing;

/// <summary>Repository port for the <see cref="ClothPrice"/> aggregate (01_ARCHITECTURE.md § 25.1 Repository Pattern).</summary>
public interface IClothPriceRepository
{
    Task<ClothPrice?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Case-insensitive exact match, used to keep <see cref="ClothPrice.ClothCode"/> unique on create/update.</summary>
    Task<ClothPrice?> GetByClothCodeAsync(string clothCode, CancellationToken cancellationToken);

    Task<PagedResult<ClothPrice>> SearchAsync(string? searchTerm, int page, int pageSize, CancellationToken cancellationToken);

    /// <summary>Every price, unpaginated — for spreadsheet export, which has no page to scroll.</summary>
    Task<IReadOnlyList<ClothPrice>> ListAllAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Whether any order was cut from this cloth — what stands between a price and being deleted.
    ///
    /// <para>Counts every order that used it, cancelled ones included: a cancelled order still
    /// records what it was going to be made from, and the stock it released was released against
    /// this entry. Deleting the price out from under any of them leaves an order naming a cloth
    /// the shop can no longer look up.</para>
    /// </summary>
    Task<bool> IsUsedOnAnyOrderAsync(Guid clothPriceId, CancellationToken cancellationToken);

    void Add(ClothPrice clothPrice);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
