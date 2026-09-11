using FluentValidation;

namespace MathilensERP.Application.Auth.Commands.Register;

public sealed class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress();

        // The full password policy (uppercase/lowercase/digit, § 10.4) is enforced by
        // ASP.NET Core Identity's CreateAsync — this just rejects the empty-field case early.
        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(8);
    }
}
