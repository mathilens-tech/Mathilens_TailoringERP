using FluentValidation;

namespace MathilensERP.Application.Orders.Commands.RemoveItem;

public sealed class RemoveOrderItemCommandValidator : AbstractValidator<RemoveOrderItemCommand>
{
    public RemoveOrderItemCommandValidator()
    {
        RuleFor(x => x.OrderId)
            .NotEmpty();

        RuleFor(x => x.OrderItemId)
            .NotEmpty();
    }
}
