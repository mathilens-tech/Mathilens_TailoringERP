using FluentValidation;

namespace MathilensERP.Application.WhatsApp.Commands.Send;

public sealed class SendWhatsAppMessageCommandValidator : AbstractValidator<SendWhatsAppMessageCommand>
{
    public SendWhatsAppMessageCommandValidator()
    {
        RuleFor(x => x.CustomerId)
            .NotEmpty();

        RuleFor(x => x.MessageType)
            .IsInEnum();

        RuleFor(x => x.Content)
            .NotEmpty()
            .MaximumLength(4096);
    }
}
