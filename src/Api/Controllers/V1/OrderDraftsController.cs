using MathilensERP.Api.Common;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Api.Contracts.Orders;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders.Drafts;
using MathilensERP.Application.Orders.Drafts.Commands;
using MathilensERP.Application.Orders.Drafts.Queries;
using MathilensERP.Shared.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>
/// Orders somebody started writing and has not finished.
///
/// <para>Under Orders.Create rather than Orders.View: a draft is the act of writing an order, so
/// anybody who may not create one has no use for a half-written one either. Every operation is
/// scoped to the signed-in user inside the handlers — there is no endpoint here that takes an owner
/// as a parameter, so one person cannot reach another's drafts by asking.</para>
/// </summary>
[ApiController]
[Route("api/v1/order-drafts")]
[Authorize(Policy = Permissions.OrdersCreate)]
public sealed class OrderDraftsController : ApiControllerBase
{
    private readonly ISender _sender;

    public OrderDraftsController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>The signed-in user's unfinished orders, newest first. Payloads omitted.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<OrderDraftSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(CancellationToken cancellationToken) =>
        ToActionResult(await _sender.Send(new ListOrderDraftsQuery(), cancellationToken));

    /// <summary>One draft, with the form state needed to resume it.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<OrderDraftDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await _sender.Send(new GetOrderDraftQuery(id), cancellationToken));

    /// <summary>
    /// Creates a draft, or replaces the one named by <paramref name="request"/>.
    ///
    /// <para>A PUT with the id in the body rather than the route, because autosave does not know on
    /// any given call whether it is creating or updating — it holds an id only after the first save
    /// has come back.</para>
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(ApiResponse<OrderDraftDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Save([FromBody] SaveOrderDraftRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await _sender.Send(
            new SaveOrderDraftCommand(request.Id, request.Kind, request.CustomerId, request.Summary, request.Payload),
            cancellationToken));

    /// <summary>Discards a draft. Already gone counts as discarded — see the handler.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await _sender.Send(new DeleteOrderDraftCommand(id), cancellationToken));
}
