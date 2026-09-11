using FluentValidation;

namespace MathilensERP.Application.Settings.Commands.Delete;

public sealed class DeleteSettingCommandValidator : AbstractValidator<DeleteSettingCommand>
{
    public DeleteSettingCommandValidator()
    {
        RuleFor(x => x.Key)
            .NotEmpty();
    }
}
