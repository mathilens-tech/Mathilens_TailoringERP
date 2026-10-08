using MathilensERP.Api.Common;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Api.Contracts.Marketing;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Marketing;
using MathilensERP.Application.Marketing.Commands.Create;
using MathilensERP.Application.Marketing.Commands.SetRecipientMessaged;
using MathilensERP.Application.Marketing.Queries.GetCampaign;
using MathilensERP.Application.Marketing.Queries.ListCampaigns;
using MathilensERP.Shared.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>
/// Marketing campaigns — a message and the customers it is for, worked by hand one WhatsApp draft at
/// a time. Guarded by the WhatsApp permissions it belongs to: reading a campaign is WhatsApp "view",
/// creating one or marking a customer messaged is WhatsApp "send", the same permission the manual
/// WhatsApp buttons elsewhere already answer to.
/// </summary>
[ApiController]
[Route("api/v1/campaigns")]
[Authorize(Policy = Permissions.WhatsAppView)]
public sealed class CampaignsController : ApiControllerBase
{
    private readonly ISender _sender;

    public CampaignsController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>Every campaign, newest first, as a summary with its progress.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CampaignListItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new ListCampaignsQuery(), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>One campaign with its customers, for the screen it is worked from.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CampaignDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetCampaignQuery(id), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Creates a campaign for the chosen customers with the message to draft to each.</summary>
    [HttpPost]
    [Authorize(Policy = Permissions.WhatsAppSend)]
    [ProducesResponseType(typeof(ApiResponse<CampaignDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateCampaignRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new CreateCampaignCommand(request.Name, request.MessageTemplate, request.CustomerIds),
            cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Marks one of a campaign's customers as messaged, or clears it again.</summary>
    [HttpPut("{id:guid}/recipients/{recipientId:guid}/messaged")]
    [Authorize(Policy = Permissions.WhatsAppSend)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetMessaged(Guid id, Guid recipientId, [FromBody] SetRecipientMessagedRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new SetRecipientMessagedCommand(id, recipientId, request.Messaged), cancellationToken);
        return ToActionResult(result);
    }
}
