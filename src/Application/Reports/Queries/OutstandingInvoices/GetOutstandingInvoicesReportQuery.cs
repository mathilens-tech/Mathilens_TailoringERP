using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Reports;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Reports.Queries.OutstandingInvoices;

/// <summary>Unpaid/partially-paid invoices, oldest first (01_ARCHITECTURE.md § 20 Reporting Strategy).</summary>
public sealed record GetOutstandingInvoicesReportQuery(int Page, int PageSize) : IQuery<Result<PagedResult<OutstandingInvoiceDto>>>;
