using FluentValidation;

namespace MathilensERP.Application.Marketing.Commands.Create;

public sealed class CreateCampaignCommandValidator : AbstractValidator<CreateCampaignCommand>
{
    public CreateCampaignCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.MessageTemplate)
            .NotEmpty()
            .MaximumLength(2000);

        RuleFor(x => x.CustomerIds)
            .NotEmpty()
            .WithMessage("Choose at least one customer for the campaign.");

        RuleForEach(x => x.CustomerIds)
            .NotEmpty();
    }
}
