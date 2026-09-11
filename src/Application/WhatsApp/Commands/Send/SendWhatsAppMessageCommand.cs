using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.WhatsApp;
using MathilensERP.Domain.WhatsApp;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.WhatsApp.Commands.Send;

public sealed record SendWhatsAppMessageCommand(Guid CustomerId, Guid? OrderId, WhatsAppMessageType MessageType, string Content) : ICommand<Result<WhatsAppMessageDto>>;
