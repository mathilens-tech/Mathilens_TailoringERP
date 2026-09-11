using MathilensERP.Domain.Inventory;
using MathilensERP.Shared.Pagination;

namespace MathilensERP.Application.Inventory;

/// <summary>Repository port for the <see cref="ClothReceipt"/> log (01_ARCHITECTURE.md § 25.1 Repository Pattern).</summary>
public interface IClothReceiptRepository
{
    Task<ClothReceipt?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// Receipts newest-first, narrowed by any combination of cloth text, cloth code and received
    /// date range — the shape the inventory screen filters by.
    /// </summary>
    Task<PagedResult<ClothReceipt>> SearchAsync(
        string? searchTerm,
        Guid? clothPriceId,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    /// <summary>
    /// Total quantity received per cloth code and unit, ordered by cloth code and paged over the
    /// distinct cloths. Summed in the database — the alternative is pulling every receipt the shop
    /// has ever recorded into memory to add them up.
    /// </summary>
    Task<PagedResult<ClothStockRow>> GetStockSummaryAsync(
        string? searchTerm,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    void Add(ClothReceipt receipt);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
