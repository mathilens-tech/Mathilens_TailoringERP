using FluentValidation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Auth.Commands.Login;

public sealed class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        // Cascade, or an empty box reports that it is required and that it is too short at the same
        // time — two messages for the one thing the reader has not done yet.
        RuleFor(x => x.UserName)
            .Cascade(CascadeMode.Stop)
            .NotEmpty()
            .MinimumLength(UserNameRules.MinimumLength)
            .WithMessage(UserNameRules.LengthMessage);

        RuleFor(x => x.Password)
            .NotEmpty();
    }
}
