using MathilensERP.Domain.Billing;
using MathilensERP.Domain.Orders;

namespace MathilensERP.Application.Reports;

public sealed record RevenueReportDto(
    DateTime FromUtc,
    DateTime ToUtc,
    int InvoiceCount,
    decimal TotalInvoiced,
    decimal TotalCollected,
    decimal TotalOutstanding);

/// <summary>
/// The money position on the orders <em>booked</em> in a date range — what the work was worth,
/// how much of it has been earned by delivering, how much cash came in against it, and how much
/// is still to collect.
///
/// Deliberately keyed on when each order was taken, not when it was delivered or paid: every
/// figure then describes one cohort of orders, so they reconcile against each other. Keying on
/// delivery date instead would make <see cref="PendingAmount"/> structurally zero, since an order
/// can no longer be delivered while any amount is outstanding on it.
///
/// This is order value (quantity × unit price), <em>not</em> invoiced value — so it counts work
/// that was never billed, which is exactly the leakage <see cref="RevenueReportDto"/> cannot see.
/// It carries no cost data and therefore says nothing about profit: the shop's cloth cost
/// (<c>ClothPrice.CostPrice</c>) is not linked to an order item, and labour and overheads are not
/// recorded anywhere.
/// </summary>
/// <param name="OrderValue">Value of every non-cancelled order booked in the range.</param>
/// <param name="DeliveredValue">The part of <paramref name="OrderValue"/> that has actually been handed over — revenue earned from this cohort.</param>
/// <param name="CollectedAmount">Cash received against these orders, across their live (non-voided) invoices.</param>
/// <param name="PendingAmount">Still to collect: the balance on live invoices, plus the full value of orders never invoiced.</param>
/// <param name="CancelledValue">Value of orders booked in the range and then cancelled — work taken and lost.</param>
/// <param name="DiscountsGiven">Discounts granted on these orders' live invoices.</param>
public sealed record OrderCollectionsReportDto(
    DateTime FromUtc,
    DateTime ToUtc,
    int OrderCount,
    decimal OrderValue,
    decimal DeliveredValue,
    decimal CollectedAmount,
    decimal PendingAmount,
    decimal CancelledValue,
    decimal DiscountsGiven);

public sealed record OrderStatusCountDto(OrderStatus Status, int Count);

public sealed record OrderStatusSummaryReportDto(DateTime FromUtc, DateTime ToUtc, IReadOnlyList<OrderStatusCountDto> StatusCounts);

public sealed record OutstandingInvoiceDto(
    Guid Id,
    Guid CustomerId,
    decimal TotalAmount,
    decimal AmountPaid,
    decimal RemainingBalance,
    InvoiceStatus Status,
    DateTime CreatedAtUtc);
