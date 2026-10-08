using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Marketing.Queries.ListCampaigns;

public sealed class ListCampaignsQueryHandler : IQueryHandler<ListCampaignsQuery, Result<IReadOnlyList<CampaignListItemDto>>>
{
    private readonly ICampaignRepository _campaignRepository;

    public ListCampaignsQueryHandler(ICampaignRepository campaignRepository)
    {
        _campaignRepository = campaignRepository;
    }

    public async Task<Result<IReadOnlyList<CampaignListItemDto>>> Handle(ListCampaignsQuery query, CancellationToken cancellationToken)
    {
        var campaigns = await _campaignRepository.ListAsync(cancellationToken);
        return Result.Success(campaigns);
    }
}
