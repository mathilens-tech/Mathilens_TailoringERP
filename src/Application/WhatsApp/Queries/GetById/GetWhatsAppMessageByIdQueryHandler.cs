using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.WhatsApp;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.WhatsApp.Queries.GetById;

public sealed class GetWhatsAppMessageByIdQueryHandler : IQueryHandler<GetWhatsAppMessageByIdQuery, Result<WhatsAppMessageDto>>
{
    private readonly IWhatsAppMessageRepository _messageRepository;

    public GetWhatsAppMessageByIdQueryHandler(IWhatsAppMessageRepository messageRepository)
    {
        _messageRepository = messageRepository;
    }

    public async Task<Result<WhatsAppMessageDto>> Handle(GetWhatsAppMessageByIdQuery query, CancellationToken cancellationToken)
    {
        var message = await _messageRepository.GetByIdAsync(query.Id, cancellationToken);

        return message is null
            ? Result.Failure<WhatsAppMessageDto>(Error.NotFound("WhatsAppMessage.NotFound", $"No message was found with id '{query.Id}'."))
            : message.ToDto();
    }
}
