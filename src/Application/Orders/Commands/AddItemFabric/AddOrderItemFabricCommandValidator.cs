using FluentValidation;

namespace MathilensERP.Application.Orders.Commands.AddItemFabric;

public sealed class AddOrderItemFabricCommandValidator : AbstractValidator<AddOrderItemFabricCommand>
{
    public AddOrderItemFabricCommandValidator()
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

        // Zero is the legacy "folded into the unit price" case and the default; only negative is wrong.
        RuleFor(x => x.RatePerMetre)
            .GreaterThanOrEqualTo(0);
    }
}
