using MathilensERP.Application.Reports;
using MathilensERP.Domain.Billing;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Pagination;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.Reports;

/// <summary>
/// Projects directly from persistence rather than materializing <see cref="Invoice"/>/
/// <see cref="Order"/> aggregates (01_ARCHITECTURE.md § 20 Reporting Strategy).
/// </summary>
public class ReportRepository : IReportRepository
{
    private readonly ApplicationDbContext _dbContext;

    public ReportRepository(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<RevenueReportDto> GetRevenueAsync(DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken)
    {
        var invoicesInRange = _dbContext.Invoices.Where(i => i.CreatedAtUtc >= fromUtc && i.CreatedAtUtc <= toUtc);

        var totals = await invoicesInRange
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Count = g.Count(),
                TotalInvoiced = g.Sum(i => i.TotalAmount),
                TotalCollected = g.Sum(i => i.AmountPaid),
            })
            .SingleOrDefaultAsync(cancellationToken);

        var invoiceCount = totals?.Count ?? 0;
        var totalInvoiced = totals?.TotalInvoiced ?? 0m;
        var totalCollected = totals?.TotalCollected ?? 0m;

        return new RevenueReportDto(fromUtc, toUtc, invoiceCount, totalInvoiced, totalCollected, totalInvoiced - totalCollected);
    }

    public async Task<OrderCollectionsReportDto> GetOrderCollectionsAsync(DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken)
    {
        var ordersInRange = _dbContext.Orders.Where(o => o.CreatedAtUtc >= fromUtc && o.CreatedAtUtc <= toUtc);

        // A cancelled order is counted for its own tile only — it is not work the shop expects to
        // deliver or be paid for, so it stays out of every other money figure.
        var billableOrders = ordersInRange.Where(o => o.Status != OrderStatus.Cancelled);

        var orderCount = await ordersInRange.CountAsync(cancellationToken);

        // Order value comes from the items, so it counts work that was never invoiced — the whole
        // point of this report. Soft-deleted items are excluded by the global query filter.
        var valueByStatus = await ordersInRange
            .SelectMany(o => o.Items.Select(i => new { o.Status, LineValue = i.Quantity * i.UnitPrice }))
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Value = g.Sum(x => x.LineValue) })
            .ToListAsync(cancellationToken);

        var cancelledValue = valueByStatus.Where(v => v.Status == OrderStatus.Cancelled).Sum(v => v.Value);
        var orderValue = valueByStatus.Where(v => v.Status != OrderStatus.Cancelled).Sum(v => v.Value);
        var deliveredValue = valueByStatus.Where(v => v.Status == OrderStatus.Delivered).Sum(v => v.Value);

        var invoiceTotals = await _dbContext.Invoices
            .Where(i => i.Status != InvoiceStatus.Void && billableOrders.Any(o => o.Id == i.OrderId))
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Invoiced = g.Sum(i => i.TotalAmount),
                Collected = g.Sum(i => i.AmountPaid),
                Discounts = g.Sum(i => i.DiscountAmount),
            })
            .SingleOrDefaultAsync(cancellationToken);

        var invoiced = invoiceTotals?.Invoiced ?? 0m;
        var collected = invoiceTotals?.Collected ?? 0m;
        var discounts = invoiceTotals?.Discounts ?? 0m;

        // Work with no bill raised against it is money still to come in just as much as an unpaid
        // invoice is, so pending is the two added together rather than order value minus collected —
        // the latter goes negative once tax pushes an invoice above the order's own value.
        var uninvoicedValue = await billableOrders
            .Where(o => !_dbContext.Invoices.Any(i => i.OrderId == o.Id && i.Status != InvoiceStatus.Void))
            .SelectMany(o => o.Items)
            .SumAsync(i => (decimal?)(i.Quantity * i.UnitPrice), cancellationToken) ?? 0m;

        return new OrderCollectionsReportDto(
            fromUtc,
            toUtc,
            orderCount,
            orderValue,
            deliveredValue,
            collected,
            invoiced - collected + uninvoicedValue,
            cancelledValue,
            discounts);
    }

    public async Task<IReadOnlyList<OrderStatusCountDto>> GetOrderStatusSummaryAsync(DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken)
    {
        var counts = await _dbContext.Orders
            .Where(o => o.CreatedAtUtc >= fromUtc && o.CreatedAtUtc <= toUtc)
            .GroupBy(o => o.Status)
            .Select(g => new OrderStatusCountDto(g.Key, g.Count()))
            .ToListAsync(cancellationToken);

        // Every status appears, even with a zero count, so dashboard/report consumers never
        // have to treat "absent" and "zero" as different cases.
        var byStatus = counts.ToDictionary(c => c.Status);
        return Enum.GetValues<OrderStatus>()
            .Select(status => byStatus.TryGetValue(status, out var count) ? count : new OrderStatusCountDto(status, 0))
            .ToList();
    }

    public async Task<PagedResult<OutstandingInvoiceDto>> GetOutstandingInvoicesAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        var query = _dbContext.Invoices.Where(i => i.Status == InvoiceStatus.Unpaid || i.Status == InvoiceStatus.PartiallyPaid);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(i => i.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new OutstandingInvoiceDto(i.Id, i.CustomerId, i.TotalAmount, i.AmountPaid, i.TotalAmount - i.AmountPaid, i.Status, i.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        return new PagedResult<OutstandingInvoiceDto>(items, page, pageSize, totalCount);
    }
}
