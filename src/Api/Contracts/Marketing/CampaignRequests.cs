namespace MathilensERP.Api.Contracts.Marketing;

/// <param name="CustomerIds">The customers the campaign is for — the ones ticked on the create screen.</param>
public sealed record CreateCampaignRequest(
    string Name,
    string MessageTemplate,
    IReadOnlyList<Guid> CustomerIds);

/// <param name="Messaged">True once this customer has been messaged, false to clear it again.</param>
public sealed record SetRecipientMessagedRequest(bool Messaged);
