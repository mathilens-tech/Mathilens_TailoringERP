using MathilensERP.Application.Billing;
using MathilensERP.Domain.Billing;
using MathilensERP.Shared.Pagination;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.Billing;

public class InvoiceRepository : IInvoiceRepository
{
    private readonly ApplicationDbContext _dbContext;

    public InvoiceRepository(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<Invoice?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        _dbContext.Invoices.Include(i => i.Payments).SingleOrDefaultAsync(i => i.Id == id, cancellationToken);

    public async Task<PagedResult<Invoice>> SearchAsync(
        Guid? customerId,
        InvoiceStatus? status,
        DateTime? fromUtc,
        DateTime? toUtc,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.Invoices.Include(i => i.Payments).AsQueryable();

        if (customerId is { } id)
        {
            query = query.Where(i => i.CustomerId == id);
        }

        if (status is { } s)
        {
            query = query.Where(i => i.Status == s);
        }

        // Half-open [from, to): the caller passes the start of the day after the range it wants,
        // so an invoice raised at 23:59:59.9 on the last day is still in it.
        if (fromUtc is { } from)
        {
            query = query.Where(i => i.CreatedAtUtc >= from);
        }

        if (toUtc is { } to)
        {
            query = query.Where(i => i.CreatedAtUtc < to);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(i => i.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Invoice>(items, page, pageSize, totalCount);
    }

    public Task<bool> ExistsBillableForOrderAsync(Guid orderId, CancellationToken cancellationToken) =>
        _dbContext.Invoices.AnyAsync(i => i.OrderId == orderId && i.Status != InvoiceStatus.Void, cancellationToken);

    /// <summary>Sums the balance in the database rather than materializing the invoices — <see cref="Invoice.RemainingBalance"/> is computed, so it is spelled out here for the provider to translate.</summary>
    public Task<decimal> GetOutstandingAmountForOrderAsync(Guid orderId, CancellationToken cancellationToken) =>
        _dbContext.Invoices
            .Where(i => i.OrderId == orderId && i.Status != InvoiceStatus.Void)
            .SumAsync(i => i.TotalAmount - i.AmountPaid, cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, decimal>> GetPaidAmountsForOrdersAsync(IReadOnlyCollection<Guid> orderIds, CancellationToken cancellationToken)
    {
        if (orderIds.Count == 0)
        {
            return new Dictionary<Guid, decimal>();
        }

        var paidByOrder = await _dbContext.Invoices
            .Where(i => i.Status != InvoiceStatus.Void && orderIds.Contains(i.OrderId))
            .GroupBy(i => i.OrderId)
            .Select(g => new { OrderId = g.Key, AmountPaid = g.Sum(i => i.AmountPaid) })
            .ToListAsync(cancellationToken);

        return paidByOrder.ToDictionary(p => p.OrderId, p => p.AmountPaid);
    }

    public void Add(Invoice invoice) => _dbContext.Invoices.Add(invoice);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);
}
