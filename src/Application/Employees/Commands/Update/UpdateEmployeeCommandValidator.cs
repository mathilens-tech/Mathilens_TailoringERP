using FluentValidation;
using MathilensERP.Application.Common.Validation;

namespace MathilensERP.Application.Employees.Commands.Update;

public sealed class UpdateEmployeeCommandValidator : AbstractValidator<UpdateEmployeeCommand>
{
    public UpdateEmployeeCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty();

        RuleFor(x => x.EmployeeCode)
            .NotEmpty()
            .MaximumLength(30);

        RuleFor(x => x.FullName)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.JobTitle)
            .MaximumLength(100);

        // Identical to create's, from the one shared definition — see that validator.
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
