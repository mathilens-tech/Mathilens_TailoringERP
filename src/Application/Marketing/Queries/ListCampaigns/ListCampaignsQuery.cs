using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Marketing.Queries.ListCampaigns;

/// <summary>Every campaign as a summary, newest first.</summary>
public sealed record ListCampaignsQuery : IQuery<Result<IReadOnlyList<CampaignListItemDto>>>;
