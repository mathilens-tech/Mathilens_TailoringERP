using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Marketing;

/// <summary>
/// One customer on a <see cref="Campaign"/>, and whether they have been messaged yet. Only ever
/// created or changed through the owning campaign, never on its own.
///
/// <para>"Messaged" is a date rather than a flag so the record says <em>when</em>, and because a
/// date reads as "done" or "not yet" exactly like a flag would while carrying more. It is set when
/// the operator opens the customer's WhatsApp draft from the campaign and can be cleared again — the
/// shop works a campaign by hand, one customer at a time, and may need to redo one.</para>
/// </summary>
public sealed class CampaignRecipient : AuditableEntity
{
    public Guid CampaignId { get; private set; }

    public Guid CustomerId { get; private set; }

    /// <summary>When this customer was messaged, or null while they still have to be.</summary>
    public DateTime? MessagedAtUtc { get; private set; }

    public bool IsMessaged => MessagedAtUtc is not null;

    private CampaignRecipient()
    {
        // Reserved for EF Core materialization.
    }

    private CampaignRecipient(Guid id)
        : base(id)
    {
    }

    internal static CampaignRecipient Create(Guid campaignId, Guid customerId)
    {
        return new CampaignRecipient(Guid.NewGuid())
        {
            CampaignId = Guard.AgainstEmpty(campaignId, nameof(campaignId)),
            CustomerId = Guard.AgainstEmpty(customerId, nameof(customerId)),
        };
    }

    /// <summary>Records that this customer has now been messaged (or clears it when false).</summary>
    internal void SetMessaged(bool messaged, DateTime nowUtc) =>
        MessagedAtUtc = messaged ? nowUtc : null;
}
