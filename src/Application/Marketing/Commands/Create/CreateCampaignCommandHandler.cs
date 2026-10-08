using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Marketing;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Marketing.Commands.Create;

public sealed class CreateCampaignCommandHandler : ICommandHandler<CreateCampaignCommand, Result<CampaignDto>>
{
    private readonly ICampaignRepository _campaignRepository;

    public CreateCampaignCommandHandler(ICampaignRepository campaignRepository)
    {
        _campaignRepository = campaignRepository;
    }

    public async Task<Result<CampaignDto>> Handle(CreateCampaignCommand command, CancellationToken cancellationToken)
    {
        var campaign = Campaign.Create(command.Name, command.MessageTemplate, command.CustomerIds);

        _campaignRepository.Add(campaign);
        await _campaignRepository.SaveChangesAsync(cancellationToken);

        // Read back through the detail projection, so the created campaign returns with its
        // customers' names and numbers already on it — the shape the view wants — rather than the
        // bare aggregate the caller would then have to re-fetch.
        var detail = await _campaignRepository.GetDetailAsync(campaign.Id, cancellationToken);
        return detail is null
            ? Result.Failure<CampaignDto>(Error.NotFound("Campaign.NotFound", "The campaign could not be read back after creation."))
            : Result.Success(detail);
    }
}
