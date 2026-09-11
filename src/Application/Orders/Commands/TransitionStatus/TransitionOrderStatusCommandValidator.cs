using FluentValidation;
using MathilensERP.Domain.Orders;

namespace MathilensERP.Application.Orders.Commands.TransitionStatus;

public sealed class TransitionOrderStatusCommandValidator : AbstractValidator<TransitionOrderStatusCommand>
{
    public TransitionOrderStatusCommandValidator()
    {
        RuleFor(x => x.OrderId)
            .NotEmpty();

        RuleFor(x => x.TargetStatus)
            .IsInEnum();

        RuleFor(x => x.DeliveredAtUtc)
            .NotNull()
            .When(x => x.TargetStatus == OrderStatus.Delivered)
            .WithMessage("A delivery date is required when marking an order as delivered.");
    }
}
