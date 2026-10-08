using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Marketing.Commands.Create;

/// <summary>Creates a campaign for the chosen customers with the message to draft to each.</summary>
public sealed record CreateCampaignCommand(
    string Name,
    string MessageTemplate,
    IReadOnlyList<Guid> CustomerIds) : ICommand<Result<CampaignDto>>;
