using FluentValidation;

namespace MathilensERP.Application.Orders.Commands.AssignEmployee;

public sealed class AssignOrderEmployeeCommandValidator : AbstractValidator<AssignOrderEmployeeCommand>
{
    public AssignOrderEmployeeCommandValidator()
    {
        RuleFor(x => x.OrderId)
            .NotEmpty();

        RuleFor(x => x.EmployeeId)
            .NotEmpty();
    }
}
