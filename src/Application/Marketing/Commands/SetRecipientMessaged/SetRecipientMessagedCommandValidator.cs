using FluentValidation;

namespace MathilensERP.Application.Marketing.Commands.SetRecipientMessaged;

public sealed class SetRecipientMessagedCommandValidator : AbstractValidator<SetRecipientMessagedCommand>
{
    public SetRecipientMessagedCommandValidator()
    {
        RuleFor(x => x.CampaignId).NotEmpty();
        RuleFor(x => x.RecipientId).NotEmpty();
    }
}
