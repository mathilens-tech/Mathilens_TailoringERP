using FluentValidation;
using MathilensERP.Application.Common.Validation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Orders.Commands.UpdateItem;

public sealed class UpdateOrderItemCommandValidator : AbstractValidator<UpdateOrderItemCommand>
{
    public UpdateOrderItemCommandValidator()
    {
        RuleFor(x => x.OrderId)
            .NotEmpty();

        RuleFor(x => x.OrderItemId)
            .NotEmpty();

        RuleFor(x => x.GarmentType)
            .MustBeAGarmentName();

        RuleFor(x => x.Quantity)
            .GreaterThan(0)
            .LessThanOrEqualTo(OrderLimits.MaxItemQuantity);

        RuleFor(x => x.UnitPrice)
            .GreaterThan(0);
    }
}
