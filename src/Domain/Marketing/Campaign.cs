using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Marketing;

/// <summary>
/// A marketing campaign: a message and the customers it is for. The shop sends it by hand — one
/// WhatsApp draft per customer, opened from the campaign screen — so a campaign is a worklist with a
/// message attached, not a bulk send. Which customers have been messaged is tracked on each
/// <see cref="CampaignRecipient"/> so a run of several hundred can be picked up where it was left.
/// </summary>
public sealed class Campaign : AuditableEntity
{
    /// <summary>What a shop would recognise it by — "Diwali 2026", "New arrivals".</summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>
    /// The WhatsApp message, as written once for the whole campaign. May contain the token
    /// <c>{name}</c>, which each draft replaces with that customer's name — the substitution is done
    /// where the draft is built, so the template is stored exactly as typed.
    /// </summary>
    public string MessageTemplate { get; private set; } = string.Empty;

    private readonly List<CampaignRecipient> _recipients = [];

    public IReadOnlyList<CampaignRecipient> Recipients => _recipients;

    private Campaign()
    {
        // Reserved for EF Core materialization.
    }

    private Campaign(Guid id)
        : base(id)
    {
    }

    /// <summary>
    /// Creates a campaign for a set of customers. Duplicate ids collapse to one recipient — a
    /// customer is on a campaign once however many times they were ticked — and an empty set is
    /// refused: a campaign with nobody to message is not one.
    /// </summary>
    public static Campaign Create(string name, string messageTemplate, IEnumerable<Guid> customerIds)
    {
        var campaign = new Campaign(Guid.NewGuid())
        {
            Name = Guard.AgainstNullOrWhiteSpace(name, nameof(name)).Trim(),
            MessageTemplate = Guard.AgainstNullOrWhiteSpace(messageTemplate, nameof(messageTemplate)).Trim(),
        };

        foreach (var customerId in customerIds.Distinct())
        {
            campaign._recipients.Add(CampaignRecipient.Create(campaign.Id, customerId));
        }

        if (campaign._recipients.Count == 0)
        {
            throw new ArgumentException("A campaign must have at least one customer.", nameof(customerIds));
        }

        return campaign;
    }

    /// <summary>Marks one recipient messaged (or clears it). A no-op if the id is not on this
    /// campaign, so a stale click does not throw.</summary>
    public void SetRecipientMessaged(Guid recipientId, bool messaged, DateTime nowUtc)
    {
        var recipient = _recipients.SingleOrDefault(r => r.Id == recipientId);
        recipient?.SetMessaged(messaged, nowUtc);
    }
}
