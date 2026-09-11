using MathilensERP.Application.Inventory;
using MathilensERP.Domain.Inventory;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Pagination;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.Inventory;

public class ClothReceiptRepository : IClothReceiptRepository
{
    private readonly ApplicationDbContext _dbContext;

    public ClothReceiptRepository(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<ClothReceipt?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        _dbContext.ClothReceipts.SingleOrDefaultAsync(r => r.Id == id, cancellationToken);

    public async Task<PagedResult<ClothReceipt>> SearchAsync(
        string? searchTerm,
        Guid? clothPriceId,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.ClothReceipts.AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            // The four things someone reconciling a supplier bill would search by.
            query = query.Where(r =>
                EF.Functions.ILike(r.ClothCode, $"%{searchTerm}%") ||
                EF.Functions.ILike(r.ClothName, $"%{searchTerm}%") ||
                (r.SupplierName != null && EF.Functions.ILike(r.SupplierName, $"%{searchTerm}%")) ||
                (r.InvoiceNumber != null && EF.Functions.ILike(r.InvoiceNumber, $"%{searchTerm}%")));
        }

        if (clothPriceId is { } id)
        {
            query = query.Where(r => r.ClothPriceId == id);
        }

        // Both ends inclusive: these are days off a calendar, not instants, so "to 5 August"
        // means the whole of that day.
        if (fromDate is { } from)
        {
            query = query.Where(r => r.ReceivedOn >= from);
        }

        if (toDate is { } to)
        {
            query = query.Where(r => r.ReceivedOn <= to);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        // Newest delivery first, and CreatedAtUtc breaks ties so two receipts entered on the same
        // day keep a stable order across pages.
        var items = await query
            .OrderByDescending(r => r.ReceivedOn)
            .ThenByDescending(r => r.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<ClothReceipt>(items, page, pageSize, totalCount);
    }

    public async Task<PagedResult<ClothStockRow>> GetStockSummaryAsync(
        string? searchTerm,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var receipts = _dbContext.ClothReceipts.AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            receipts = receipts.Where(r =>
                EF.Functions.ILike(r.ClothCode, $"%{searchTerm}%") ||
                EF.Functions.ILike(r.ClothName, $"%{searchTerm}%"));
        }

        // Paging is over distinct cloths, not over the grouped rows: a cloth received in two units
        // produces two rows, and paging those directly would split one cloth across a page break.
        var clothCodes = receipts
            .GroupBy(r => new { r.ClothPriceId, r.ClothCode })
            .Select(g => new { g.Key.ClothPriceId, g.Key.ClothCode });

        var totalCount = await clothCodes.CountAsync(cancellationToken);

        var pagedClothIds = await clothCodes
            .OrderBy(c => c.ClothCode)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => c.ClothPriceId)
            .ToListAsync(cancellationToken);

        var receivedRows = await receipts
            .Where(r => pagedClothIds.Contains(r.ClothPriceId))
            .GroupBy(r => new { r.ClothPriceId, r.ClothCode, r.ClothName, r.Unit })
            .Select(g => new
            {
                g.Key.ClothPriceId,
                g.Key.ClothCode,
                g.Key.ClothName,
                g.Key.Unit,
                Received = g.Sum(r => r.Quantity),
                LastReceivedOn = g.Max(r => r.ReceivedOn),
            })
            .ToListAsync(cancellationToken);

        // What orders have taken out. Only shop-supplied fabric on live orders counts: cloth the
        // customer brought was never the shop's, and cancelling an order releases what it held.
        // The global soft-delete filters already exclude removed items and deleted orders.
        var usedRows = await _dbContext.FabricDetails
            .Where(f => f.ClothPriceId != null
                && pagedClothIds.Contains(f.ClothPriceId!.Value)
                && f.Source == FabricSource.ShopSupplied
                && _dbContext.OrderItems.Any(i => i.Id == f.OrderItemId
                    && _dbContext.Orders.Any(o => o.Id == i.OrderId && o.Status != OrderStatus.Cancelled)))
            .GroupBy(f => new { ClothPriceId = f.ClothPriceId!.Value, f.Unit })
            .Select(g => new { g.Key.ClothPriceId, g.Key.Unit, Used = g.Sum(f => f.Quantity) })
            .ToListAsync(cancellationToken);

        var usedByClothAndUnit = usedRows.ToDictionary(u => (u.ClothPriceId, u.Unit), u => u.Used);

        var rows = receivedRows
            .Select(r => new ClothStockRow(
                r.ClothPriceId,
                r.ClothCode,
                r.ClothName,
                r.Unit,
                r.Received,
                usedByClothAndUnit.TryGetValue((r.ClothPriceId, r.Unit), out var used) ? used : 0m,
                r.LastReceivedOn))
            .ToList();

        // Cloth consumed in a unit it was never received in would otherwise vanish from the
        // screen — showing it as a negative available figure is how that mistake becomes visible.
        var receivedKeys = rows.Select(r => (r.ClothPriceId, r.Unit)).ToHashSet();
        foreach (var used in usedRows.Where(u => !receivedKeys.Contains((u.ClothPriceId, u.Unit))))
        {
            var known = rows.FirstOrDefault(r => r.ClothPriceId == used.ClothPriceId);
            rows.Add(new ClothStockRow(
                used.ClothPriceId,
                known?.ClothCode ?? string.Empty,
                known?.ClothName ?? string.Empty,
                used.Unit,
                0m,
                used.Used,
                null));
        }

        return new PagedResult<ClothStockRow>(rows, page, pageSize, totalCount);
    }

    public void Add(ClothReceipt receipt) => _dbContext.ClothReceipts.Add(receipt);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);
}
