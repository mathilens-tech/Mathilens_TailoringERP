using FluentValidation;

namespace MathilensERP.Application.Orders.Commands.Update;

public sealed class UpdateOrderCommandValidator : AbstractValidator<UpdateOrderCommand>
{
    public UpdateOrderCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty();

        RuleFor(x => x.CustomerId)
            .NotEmpty();

        RuleFor(x => x.EmployeeId)
            .NotEqual(Guid.Empty)
            .When(x => x.EmployeeId.HasValue);

        RuleFor(x => x.Notes)
            .MaximumLength(2000);
    }
}
