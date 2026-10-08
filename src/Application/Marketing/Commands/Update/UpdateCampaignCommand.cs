using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Marketing.Commands.Update;

/// <summary>Corrects an existing campaign's name and message. Recipients are unchanged.</summary>
public sealed record UpdateCampaignCommand(
    Guid Id,
    string Name,
    string MessageTemplate) : ICommand<Result<CampaignDto>>;
