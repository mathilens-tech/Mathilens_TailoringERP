using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Marketing.Commands.Update;

public sealed class UpdateCampaignCommandHandler : ICommandHandler<UpdateCampaignCommand, Result<CampaignDto>>
{
    private readonly ICampaignRepository _campaignRepository;

    public UpdateCampaignCommandHandler(ICampaignRepository campaignRepository)
    {
        _campaignRepository = campaignRepository;
    }

    public async Task<Result<CampaignDto>> Handle(UpdateCampaignCommand command, CancellationToken cancellationToken)
    {
        var campaign = await _campaignRepository.GetByIdAsync(command.Id, cancellationToken);
        if (campaign is null)
        {
            return Result.Failure<CampaignDto>(Error.NotFound("Campaign.NotFound", $"No campaign was found with id '{command.Id}'."));
        }

        campaign.UpdateDetails(command.Name, command.MessageTemplate);
        await _campaignRepository.SaveChangesAsync(cancellationToken);

        var detail = await _campaignRepository.GetDetailAsync(command.Id, cancellationToken);
        return detail is null
            ? Result.Failure<CampaignDto>(Error.NotFound("Campaign.NotFound", "The campaign could not be read back after the update."))
            : Result.Success(detail);
    }
}
