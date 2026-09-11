using FluentValidation;

namespace MathilensERP.Application.Settings.Commands.Upsert;

public sealed class UpsertSettingCommandValidator : AbstractValidator<UpsertSettingCommand>
{
    public UpsertSettingCommandValidator()
    {
        RuleFor(x => x.Key)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Value)
            .NotNull()
            .MaximumLength(4000);
    }
}
