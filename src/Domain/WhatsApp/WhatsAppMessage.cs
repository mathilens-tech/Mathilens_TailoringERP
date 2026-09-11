using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.WhatsApp;

/// <summary>
/// A single customer-communication message sent (or attempted) via WhatsApp — order updates,
/// reminders, delivery notices (00_MASTER_SPEC.md § 3, § 5 Technology Stack). Persisted as a
/// log for auditability and delivery-status tracking, per 01_ARCHITECTURE.md § 11.5 ("failures
/// are logged and surfaced").
///
/// <b>Design decision:</b> sending is a deliberate, explicit Application command, not an
/// automatic reaction to an order status change — this product has no domain-event dispatch
/// mechanism actually implemented yet, even though 01_ARCHITECTURE.md § 26 describes one as
/// already active ("Now:"). That gap predates this module (Billing's invoicing has the same
/// note) and isn't retrofitted here; see CHANGELOG.md.
/// </summary>
public sealed class WhatsAppMessage : AuditableEntity
{
    public Guid CustomerId { get; private set; }

    public Guid? OrderId { get; private set; }

    public WhatsAppMessageType MessageType { get; private set; }

    public string Content { get; private set; } = string.Empty;

    public WhatsAppMessageStatus Status { get; private set; }

    public string? ProviderMessageId { get; private set; }

    public string? FailureReason { get; private set; }

    private WhatsAppMessage()
    {
        // Reserved for EF Core materialization.
    }

    private WhatsAppMessage(Guid id)
        : base(id)
    {
    }

    public static WhatsAppMessage Create(Guid customerId, Guid? orderId, WhatsAppMessageType messageType, string content)
    {
        return new WhatsAppMessage(Guid.NewGuid())
        {
            CustomerId = Guard.AgainstEmpty(customerId, nameof(customerId)),
            OrderId = orderId,
            MessageType = messageType,
            Content = Guard.AgainstNullOrWhiteSpace(content, nameof(content)),
            Status = WhatsAppMessageStatus.Pending,
        };
    }

    public void MarkSent(string providerMessageId)
    {
        Status = WhatsAppMessageStatus.Sent;
        ProviderMessageId = Guard.AgainstNullOrWhiteSpace(providerMessageId, nameof(providerMessageId));
        FailureReason = null;
    }

    public void MarkFailed(string failureReason)
    {
        Status = WhatsAppMessageStatus.Failed;
        FailureReason = Guard.AgainstNullOrWhiteSpace(failureReason, nameof(failureReason));
    }
}
