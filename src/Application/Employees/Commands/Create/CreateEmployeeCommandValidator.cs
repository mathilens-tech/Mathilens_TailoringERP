using FluentValidation;
using MathilensERP.Application.Common.Validation;

namespace MathilensERP.Application.Employees.Commands.Create;

public sealed class CreateEmployeeCommandValidator : AbstractValidator<CreateEmployeeCommand>
{
    public CreateEmployeeCommandValidator()
    {
        RuleFor(x => x.EmployeeCode)
            .NotEmpty()
            .MaximumLength(30);

        RuleFor(x => x.FullName)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.JobTitle)
            .MaximumLength(100);

        // The same rules the customer form applies, from the one shared definition — a number is a
        // number whoever it belongs to, and the shop should not learn two sets of rules.
        RuleFor(x => x.PhoneNumber)
            .Cascade(CascadeMode.Stop)
            .MustBeAnIndianMobileNumber();

        RuleFor(x => x.Email)
            .MustBeAnEmailAddressWhenGiven();

        RuleFor(x => x.JoiningDate)
            .NotEqual(default(DateOnly))
            .WithMessage("Enter the joining date.");

        RuleFor(x => x.EmploymentType)
            .IsInEnum();

    }
}
