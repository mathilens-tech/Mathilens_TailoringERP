using MathilensERP.Api.Common;
using MathilensERP.Shared.Authorization;
using MathilensERP.Api.Common.Export;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Reports;
using MathilensERP.Application.Reports.Queries.OrderCollections;
using MathilensERP.Application.Reports.Queries.OrderStatusSummary;
using MathilensERP.Application.Reports.Queries.OutstandingInvoices;
using MathilensERP.Application.Reports.Queries.Revenue;
using MathilensERP.Shared.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>Operational and business reporting endpoints (00_MASTER_SPEC.md § 3, 01_ARCHITECTURE.md § 20). URL-segment versioned per § 8.2.</summary>
[ApiController]
[Route("api/v1/reports")]
[Authorize(Policy = Permissions.ReportsView)]
public sealed class ReportsController : ApiControllerBase
{
    /// <summary>An export takes the list whole; page one of an aged-debt list is of no use to anybody.</summary>
    private const int ExportPageSize = 5000;

    private readonly ISender _sender;

    public ReportsController(ISender sender)
    {
        _sender = sender;
    }


    /// <summary>
    /// Any of the four figure reports, as a spreadsheet or a PDF.
    ///
    /// One endpoint rather than four, because three of these are a handful of totals rather than a
    /// table: as a file they are the same shape, a list of labels and their values, and splitting
    /// that into separate endpoints would be four copies of the same six lines.
    /// </summary>
    [HttpGet("export")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Export(
        [FromQuery] string report,
        [FromQuery] DateTime fromUtc,
        [FromQuery] DateTime toUtc,
        [FromQuery] ExportFormat format = ExportFormat.Xlsx,
        CancellationToken cancellationToken = default)
    {
        // The period every one of these is about. Printed on the document because a page of totals
        // with no dates on it cannot be checked by whoever is handed it.
        var period = $"{fromUtc:dd MMM yyyy} to {toUtc:dd MMM yyyy}";

        switch (report?.ToLowerInvariant())
        {
            case "order-collections":
            {
                var result = await _sender.Send(new GetOrderCollectionsReportQuery(fromUtc, toUtc), cancellationToken);
                if (result.IsFailure)
                {
                    return ToActionResult(result);
                }

                var r = result.Value;
                return ExportResultFactory.Create(format, "Orders & Collections", "orders-collections",
                    ["Measure", "Value"],
                    [
                        ["Orders", r.OrderCount],
                        ["Order value", r.OrderValue],
                        ["Delivered value", r.DeliveredValue],
                        ["Collected", r.CollectedAmount],
                        ["Pending", r.PendingAmount],
                        ["Cancelled", r.CancelledValue],
                        ["Discounts given", r.DiscountsGiven],
                    ],
                    period);
            }

            case "revenue":
            {
                var result = await _sender.Send(new GetRevenueReportQuery(fromUtc, toUtc), cancellationToken);
                if (result.IsFailure)
                {
                    return ToActionResult(result);
                }

                var r = result.Value;
                return ExportResultFactory.Create(format, "Revenue", "revenue",
                    ["Measure", "Value"],
                    [
                        ["Invoices", r.InvoiceCount],
                        ["Invoiced", r.TotalInvoiced],
                        ["Collected", r.TotalCollected],
                        ["Outstanding", r.TotalOutstanding],
                    ],
                    period);
            }

            case "order-status":
            {
                var result = await _sender.Send(new GetOrderStatusSummaryReportQuery(fromUtc, toUtc), cancellationToken);
                if (result.IsFailure)
                {
                    return ToActionResult(result);
                }

                return ExportResultFactory.Create(format, "Orders by Status", "orders-by-status",
                    ["Status", "Count"],
                    result.Value.StatusCounts.Select(c => new object?[] { c.Status.ToString(), c.Count }).ToList(),
                    period);
            }

            case "outstanding-invoices":
            {
                // No date range: an unpaid invoice matters whenever it was raised, which is why the
                // screen has no range either.
                var result = await _sender.Send(
                    new GetOutstandingInvoicesReportQuery(PaginationDefaults.DefaultPage, ExportPageSize),
                    cancellationToken);

                if (result.IsFailure)
                {
                    return ToActionResult(result);
                }

                return ExportResultFactory.Create(format, "Outstanding Invoices", "outstanding-invoices",
                    ["Status", "Total", "Paid", "Balance", "Raised"],
                    result.Value.Items
                        .Select(i => new object?[] { i.Status.ToString(), i.TotalAmount, i.AmountPaid, i.RemainingBalance, i.CreatedAtUtc })
                        .ToList());
            }

            default:
                return BadRequest(ApiErrorResponse.From(
                    "Reports.UnknownReport",
                    "That is not a report that can be exported."));
        }
    }

    /// <summary>Total invoiced, collected, and outstanding amounts for invoices created within a date range.</summary>
    [HttpGet("revenue")]
    [ProducesResponseType(typeof(ApiResponse<RevenueReportDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Revenue([FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetRevenueReportQuery(fromUtc, toUtc), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>
    /// The money position on orders booked within a date range — order value, delivered value,
    /// collected, still pending, cancelled value and discounts given. Unlike <see cref="Revenue"/>
    /// this counts order value rather than invoiced value, so work that was never billed is included.
    /// </summary>
    [HttpGet("order-collections")]
    [ProducesResponseType(typeof(ApiResponse<OrderCollectionsReportDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> OrderCollections([FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetOrderCollectionsReportQuery(fromUtc, toUtc), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Order counts by status for orders created within a date range.</summary>
    [HttpGet("order-status-summary")]
    [ProducesResponseType(typeof(ApiResponse<OrderStatusSummaryReportDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> OrderStatusSummary([FromQuery] DateTime fromUtc, [FromQuery] DateTime toUtc, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetOrderStatusSummaryReportQuery(fromUtc, toUtc), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Unpaid/partially-paid invoices, oldest first, paginated (00_MASTER_SPEC.md § 8.3).</summary>
    [HttpGet("outstanding-invoices")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<OutstandingInvoiceDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> OutstandingInvoices(
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new GetOutstandingInvoicesReportQuery(page, pageSize), cancellationToken);
        return ToPagedActionResult(result);
    }
}
