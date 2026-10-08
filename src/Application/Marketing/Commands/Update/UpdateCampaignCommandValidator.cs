using FluentValidation;

namespace MathilensERP.Application.Marketing.Commands.Update;

public sealed class UpdateCampaignCommandValidator : AbstractValidator<UpdateCampaignCommand>
{
    public UpdateCampaignCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.MessageTemplate)
            .NotEmpty()
            .MaximumLength(2000);
    }
}
