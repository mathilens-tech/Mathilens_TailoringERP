using MathilensERP.Domain.WhatsApp;

namespace MathilensERP.Application.WhatsApp;

internal static class WhatsAppMessageMapper
{
    public static WhatsAppMessageDto ToDto(this WhatsAppMessage message) =>
        new(
            message.Id,
            message.CustomerId,
            message.OrderId,
            message.MessageType,
            message.Content,
            message.Status,
            message.ProviderMessageId,
            message.FailureReason,
            message.CreatedAtUtc);
}
