using MathilensERP.Shared.Pagination;

namespace MathilensERP.Application.Reports;

/// <summary>
/// Read-only projections over Orders/Invoices for reporting (01_ARCHITECTURE.md § 20
/// Reporting Strategy — "dedicated Application queries, shaped specifically for their report
/// output... project directly from persistence... bypassing full entity materialization").
/// Reports have no aggregate/entity of their own; this port is the entire module.
/// </summary>
public interface IReportRepository
{
    Task<RevenueReportDto> GetRevenueAsync(DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken);

    Task<OrderCollectionsReportDto> GetOrderCollectionsAsync(DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken);

    Task<IReadOnlyList<OrderStatusCountDto>> GetOrderStatusSummaryAsync(DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken);

    Task<PagedResult<OutstandingInvoiceDto>> GetOutstandingInvoicesAsync(int page, int pageSize, CancellationToken cancellationToken);
}
