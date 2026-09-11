using MathilensERP.Domain.WhatsApp;

namespace MathilensERP.Application.WhatsApp;

public sealed record WhatsAppMessageDto(
    Guid Id,
    Guid CustomerId,
    Guid? OrderId,
    WhatsAppMessageType MessageType,
    string Content,
    WhatsAppMessageStatus Status,
    string? ProviderMessageId,
    string? FailureReason,
    DateTime CreatedAtUtc);
