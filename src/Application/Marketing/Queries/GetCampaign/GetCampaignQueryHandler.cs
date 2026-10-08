using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Marketing.Queries.GetCampaign;

public sealed class GetCampaignQueryHandler : IQueryHandler<GetCampaignQuery, Result<CampaignDto>>
{
    private readonly ICampaignRepository _campaignRepository;

    public GetCampaignQueryHandler(ICampaignRepository campaignRepository)
    {
        _campaignRepository = campaignRepository;
    }

    public async Task<Result<CampaignDto>> Handle(GetCampaignQuery query, CancellationToken cancellationToken)
    {
        var detail = await _campaignRepository.GetDetailAsync(query.Id, cancellationToken);
        return detail is null
            ? Result.Failure<CampaignDto>(Error.NotFound("Campaign.NotFound", $"No campaign was found with id '{query.Id}'."))
            : Result.Success(detail);
    }
}
