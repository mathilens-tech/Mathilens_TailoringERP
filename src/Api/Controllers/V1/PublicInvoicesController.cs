using MathilensERP.Api.Common;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Application.Billing;
using MathilensERP.Application.Billing.Queries.GetPublicInvoice;
using MathilensERP.Application.Common.Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>
/// The one door into this API that is not behind a login: an invoice, read-only, by share token.
///
/// <para>A customer opening a link from WhatsApp has no account and never will, so the alternative
/// to this is attaching the bill to the message as a file the shop has to produce by hand. The
/// token is the whole of the authorisation — it is encrypted, so it cannot be guessed or walked,
/// and it names one invoice and grants nothing else.</para>
///
/// <para>Separate controller rather than an <c>[AllowAnonymous]</c> action on InvoicesController:
/// that class carries a class-level <c>[Authorize]</c>, and an anonymous hole punched through it is
/// one refactor away from being overlooked. A reader asking "what can be reached without signing
/// in?" should find the answer in one file.</para>
/// </summary>
[ApiController]
[Route("api/v1/public/invoices")]
[AllowAnonymous]
public sealed class PublicInvoicesController : ApiControllerBase
{
    private readonly ISender _sender;

    public PublicInvoicesController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>The invoice a share token refers to. 404 for every token this server did not issue.</summary>
    [HttpGet("{token}")]
    [ProducesResponseType(typeof(ApiResponse<PublicInvoiceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByToken(string token, CancellationToken cancellationToken) =>
        ToActionResult(await _sender.Send(new GetPublicInvoiceQuery(token), cancellationToken));
}
