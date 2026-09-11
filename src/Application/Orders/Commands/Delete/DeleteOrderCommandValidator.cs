using FluentValidation;

namespace MathilensERP.Application.Orders.Commands.Delete;

public sealed class DeleteOrderCommandValidator : AbstractValidator<DeleteOrderCommand>
{
    public DeleteOrderCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty();
    }
}
