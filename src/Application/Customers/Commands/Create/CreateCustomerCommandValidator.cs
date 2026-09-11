using FluentValidation;
using MathilensERP.Application.Common.Validation;

namespace MathilensERP.Application.Customers.Commands.Create;

public sealed class CreateCustomerCommandValidator : AbstractValidator<CreateCustomerCommand>
{
    public CreateCustomerCommandValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty()
            .MaximumLength(200);

        // Shared with the edit form and the spreadsheet import — see ContactRules for why the
        // rules live there rather than being spelled out in each validator.
        RuleFor(x => x.PhoneNumber)
            .Cascade(CascadeMode.Stop)
            .MustBeAnIndianMobileNumber();

        RuleFor(x => x.Email)
            .MustBeAnEmailAddressWhenGiven();

        RuleFor(x => x.Address)
            .MaximumLength(500);

        RuleFor(x => x.Notes)
            .MaximumLength(2000);
    }
}
