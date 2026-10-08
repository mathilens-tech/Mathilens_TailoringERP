using FluentValidation;

namespace MathilensERP.Application.Orders.Commands.RemoveItemFabric;

public sealed class RemoveOrderItemFabricCommandValidator : AbstractValidator<RemoveOrderItemFabricCommand>
{
    public RemoveOrderItemFabricCommandValidator()
    {
        RuleFor(x => x.OrderId)
            .NotEmpty();

        RuleFor(x => x.OrderItemId)
            .NotEmpty();

        RuleFor(x => x.FabricId)
            .NotEmpty();
    }
}
