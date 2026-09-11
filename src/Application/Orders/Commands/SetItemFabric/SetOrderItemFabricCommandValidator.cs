using FluentValidation;

namespace MathilensERP.Application.Orders.Commands.SetItemFabric;

public sealed class SetOrderItemFabricCommandValidator : AbstractValidator<SetOrderItemFabricCommand>
{
    public SetOrderItemFabricCommandValidator()
    {
        RuleFor(x => x.OrderId)
            .NotEmpty();

        RuleFor(x => x.OrderItemId)
            .NotEmpty();

        RuleFor(x => x.FabricType)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.Source)
            .IsInEnum();

        RuleFor(x => x.Color)
            .MaximumLength(50);

        RuleFor(x => x.Quantity)
            .GreaterThan(0);
    }
}
