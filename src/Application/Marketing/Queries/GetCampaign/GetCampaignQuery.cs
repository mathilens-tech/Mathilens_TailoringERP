using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Marketing.Queries.GetCampaign;

/// <summary>One campaign with its customers, for the screen it is worked from.</summary>
public sealed record GetCampaignQuery(Guid Id) : IQuery<Result<CampaignDto>>;
