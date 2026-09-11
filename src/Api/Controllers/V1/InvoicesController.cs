using MathilensERP.Api.Common;
using MathilensERP.Shared.Authorization;
using MathilensERP.Api.Contracts.Billing;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Application.Billing;
using MathilensERP.Application.Billing.Commands.Create;
using MathilensERP.Application.Billing.Commands.RecordPayment;
using MathilensERP.Application.Billing.Commands.Void;
using MathilensERP.Application.Billing.Queries.GetById;
using MathilensERP.Application.Billing.Queries.GetShareToken;
using MathilensERP.Application.Billing.Queries.Search;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Billing;
using MathilensERP.Shared.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>Billing endpoints (00_MASTER_SPEC.md § 3, 02_DATABASE.md §§ 10.9-10.10). URL-segment versioned per § 8.2.</summary>
[ApiController]
[Route("api/v1/invoices")]
[Authorize(Policy = Permissions.InvoicesView)]
public sealed class InvoicesController : ApiControllerBase
{
    private readonly ISender _sender;

    public InvoicesController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>Issues a new invoice for an order.</summary>
    [HttpPost]
    [Authorize(Policy = Permissions.InvoicesCreate)]
    [ProducesResponseType(typeof(ApiResponse<InvoiceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateInvoiceRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new CreateInvoiceCommand(request.OrderId, request.TaxAmount, request.DiscountAmount), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Returns a single invoice, with its payments, by id.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<InvoiceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetInvoiceByIdQuery(id), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>
    /// Searches invoices by customer, status and/or the date the invoice was raised, paginated
    /// (00_MASTER_SPEC.md § 8.3). <paramref name="from"/>/<paramref name="to"/> are UTC instants
    /// bounding a half-open range — the caller decides which instants its local "today" spans.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<InvoiceDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Search(
        [FromQuery] Guid? customerId,
        [FromQuery] InvoiceStatus? status,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        // Npgsql stores these columns as timestamptz, which rejects a DateTime that isn't tagged
        // UTC. Model binding hands back Unspecified/Local depending on how the client formatted
        // the value, so the kind is normalized here rather than trusted.
        var result = await _sender.Send(
            new SearchInvoicesQuery(customerId, status, ToUtc(from), ToUtc(to), page, pageSize),
            cancellationToken);
        return ToPagedActionResult(result);
    }

    private static DateTime? ToUtc(DateTime? value) => value switch
    {
        null => null,
        { Kind: DateTimeKind.Utc } utc => utc,
        { Kind: DateTimeKind.Local } local => local.ToUniversalTime(),
        var unspecified => DateTime.SpecifyKind(unspecified.Value, DateTimeKind.Utc),
    };

    /// <summary>Records a payment against an invoice, supporting partial and multiple payments.</summary>
    [HttpPost("{id:guid}/payments")]
    [Authorize(Policy = Permissions.InvoicesPayment)]
    [ProducesResponseType(typeof(ApiResponse<InvoiceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RecordPayment(Guid id, [FromBody] RecordPaymentRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new RecordPaymentCommand(id, request.Amount, request.Method), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>
    /// The share token for an invoice — the opaque half of the read-only link a customer is sent.
    ///
    /// <para>Guarded by InvoicesView, the same right as reading the invoice itself: handing out a
    /// link to a bill discloses exactly what opening the bill discloses.</para>
    /// </summary>
    [HttpGet("{id:guid}/share-token")]
    [ProducesResponseType(typeof(ApiResponse<InvoiceShareTokenDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetShareToken(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetInvoiceShareTokenQuery(id), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Voids an unpaid invoice with no recorded payments.</summary>
    [HttpPost("{id:guid}/void")]
    [Authorize(Policy = Permissions.InvoicesVoid)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Void(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new VoidInvoiceCommand(id), cancellationToken);
        return ToActionResult(result);
    }
}
