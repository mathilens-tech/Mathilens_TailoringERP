using MathilensERP.Domain.WhatsApp;

namespace MathilensERP.Api.Contracts.WhatsApp;

public sealed record SendWhatsAppMessageRequest(Guid CustomerId, Guid? OrderId, WhatsAppMessageType MessageType, string Content);
