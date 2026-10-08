using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Marketing.Commands.SetRecipientMessaged;

public sealed class SetRecipientMessagedCommandHandler : ICommandHandler<SetRecipientMessagedCommand, Result>
{
    private readonly ICampaignRepository _campaignRepository;

    public SetRecipientMessagedCommandHandler(ICampaignRepository campaignRepository)
    {
        _campaignRepository = campaignRepository;
    }

    public async Task<Result> Handle(SetRecipientMessagedCommand command, CancellationToken cancellationToken)
    {
        var campaign = await _campaignRepository.GetByIdAsync(command.CampaignId, cancellationToken);
        if (campaign is null)
        {
            return Result.Failure(Error.NotFound("Campaign.NotFound", $"No campaign was found with id '{command.CampaignId}'."));
        }

        // A recipient not on this campaign is a no-op in the aggregate, so a stale click resolves to
        // success — the end state the caller asked for is already true.
        campaign.SetRecipientMessaged(command.RecipientId, command.Messaged, DateTime.UtcNow);
        await _campaignRepository.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
