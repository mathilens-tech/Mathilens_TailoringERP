using MathilensERP.Api.Common;
using MathilensERP.Shared.Authorization;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Api.Contracts.WhatsApp;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.WhatsApp;
using MathilensERP.Application.WhatsApp.Commands.RecordShare;
using MathilensERP.Application.WhatsApp.Commands.Send;
using MathilensERP.Application.WhatsApp.Queries.GetById;
using MathilensERP.Application.WhatsApp.Queries.Search;
using MathilensERP.Domain.WhatsApp;
using MathilensERP.Shared.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>WhatsApp customer-communication endpoints (00_MASTER_SPEC.md § 3). URL-segment versioned per § 8.2.</summary>
[ApiController]
[Route("api/v1/whatsapp-messages")]
[Authorize(Policy = Permissions.WhatsAppView)]
public sealed class WhatsAppMessagesController : ApiControllerBase
{
    private readonly ISender _sender;

    public WhatsAppMessagesController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>
    /// Notes that staff opened WhatsApp to share an invoice — a share started, not a message sent.
    ///
    /// <para>WhatsAppView rather than WhatsAppSend: nothing is dispatched here, and the person doing
    /// it has already been allowed to read the invoice they are sharing.</para>
    /// </summary>
    [HttpPost("share-opened")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RecordShareOpened([FromBody] RecordWhatsAppShareRequest request, CancellationToken cancellationToken)
    {
        var command = new RecordWhatsAppShareCommand(request.CustomerId, request.OrderNumber, request.InvoiceNumber);
        return ToActionResult(await _sender.Send(command, cancellationToken));
    }

    /// <summary>Sends a WhatsApp message to a customer and logs the attempt/outcome.</summary>
    [HttpPost]
    [Authorize(Policy = Permissions.WhatsAppSend)]
    [ProducesResponseType(typeof(ApiResponse<WhatsAppMessageDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Send([FromBody] SendWhatsAppMessageRequest request, CancellationToken cancellationToken)
    {
        var command = new SendWhatsAppMessageCommand(request.CustomerId, request.OrderId, request.MessageType, request.Content);
        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Returns a single message log entry by id.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<WhatsAppMessageDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetWhatsAppMessageByIdQuery(id), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Searches the message log by customer, order, and/or delivery status, paginated (00_MASTER_SPEC.md § 8.3).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WhatsAppMessageDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Search(
        [FromQuery] Guid? customerId,
        [FromQuery] Guid? orderId,
        [FromQuery] WhatsAppMessageStatus? status,
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new SearchWhatsAppMessagesQuery(customerId, orderId, status, page, pageSize), cancellationToken);
        return ToPagedActionResult(result);
    }
}
