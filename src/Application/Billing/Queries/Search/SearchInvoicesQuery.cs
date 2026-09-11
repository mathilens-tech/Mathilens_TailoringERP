using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Billing;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Billing.Queries.Search;

/// <summary>
/// Filterable by customer, status and/or raised-date range (00_MASTER_SPEC.md § 8.4) — the
/// operational shape 02_DATABASE.md § 10.9's composite status+date index exists for.
/// </summary>
/// <param name="FromUtc">Inclusive lower bound on when the invoice was raised. The caller sends
/// real UTC instants: "today" is a shop-local day, and only the browser knows which instants
/// that spans.</param>
/// <param name="ToUtc">Exclusive upper bound, so a caller can pass the start of the next day
/// without having to reason about how precise the stored timestamp is.</param>
public sealed record SearchInvoicesQuery(
    Guid? CustomerId,
    InvoiceStatus? Status,
    DateTime? FromUtc,
    DateTime? ToUtc,
    int Page,
    int PageSize) : IQuery<Result<PagedResult<InvoiceDto>>>;
