using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Marketing.Commands.SetRecipientMessaged;

/// <summary>Marks one of a campaign's customers as messaged, or clears it again.</summary>
public sealed record SetRecipientMessagedCommand(
    Guid CampaignId,
    Guid RecipientId,
    bool Messaged) : ICommand<Result>;
