using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.WhatsApp;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.WhatsApp.Queries.GetById;

public sealed record GetWhatsAppMessageByIdQuery(Guid Id) : IQuery<Result<WhatsAppMessageDto>>;
