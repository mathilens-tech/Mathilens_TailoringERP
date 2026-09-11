using FluentValidation;
using MathilensERP.Application.Common.Validation;

namespace MathilensERP.Application.Customers.Commands.Update;

public sealed class UpdateCustomerCommandValidator : AbstractValidator<UpdateCustomerCommand>
{
    public UpdateCustomerCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty();

        RuleFor(x => x.FullName)
            .NotEmpty()
            .MaximumLength(200);

        // Identical to create's, from the one shared definition: a number the counter accepts and
        // the edit screen then refuses would trap a customer who cannot be saved again.
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
