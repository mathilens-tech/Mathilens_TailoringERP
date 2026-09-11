namespace MathilensERP.Domain.WhatsApp;

/// <summary>00_MASTER_SPEC.md § 3 / § 5: "order updates, reminders, delivery notices at minimum".</summary>
public enum WhatsAppMessageType
{
    OrderStatusUpdate,
    DeliveryReminder,
    Custom
}
