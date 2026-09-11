using MathilensERP.Domain.Billing;
using MathilensERP.Shared.Pagination;

namespace MathilensERP.Application.Billing;

/// <summary>Repository port for the <see cref="Invoice"/> aggregate (01_ARCHITECTURE.md § 25.1 Repository Pattern) — includes its Payments on every read.</summary>
public interface IInvoiceRepository
{
    Task<Invoice?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <param name="fromUtc">Inclusive lower bound on <see cref="Domain.Common.AuditableEntity.CreatedAtUtc"/>; null for no lower bound.</param>
    /// <param name="toUtc">Exclusive upper bound; null for no upper bound.</param>
    Task<PagedResult<Invoice>> SearchAsync(
        Guid? customerId,
        InvoiceStatus? status,
        DateTime? fromUtc,
        DateTime? toUtc,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    /// <summary>Whether any live (non-voided) invoice bills the given order — used to keep a billed order from being deleted.</summary>
    Task<bool> ExistsBillableForOrderAsync(Guid orderId, CancellationToken cancellationToken);

    /// <summary>
    /// What the customer still owes across every live (non-voided) invoice for the order — zero when
    /// nothing is outstanding, including when the order was never invoiced. Used to keep an order with
    /// a pending amount from being handed over.
    /// </summary>
    Task<decimal> GetOutstandingAmountForOrderAsync(Guid orderId, CancellationToken cancellationToken);

    /// <summary>
    /// What has been collected against each of the given orders, across their live (non-voided)
    /// invoices. Answered for a whole page of orders in one query rather than one per order; orders
    /// with nothing collected are simply absent from the result.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, decimal>> GetPaidAmountsForOrdersAsync(IReadOnlyCollection<Guid> orderIds, CancellationToken cancellationToken);

    void Add(Invoice invoice);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
