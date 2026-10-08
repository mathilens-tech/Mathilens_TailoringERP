using FluentValidation;
using MathilensERP.Application.Common.Validation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Orders.Commands.Create;

public sealed class CreateOrderCommandValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderCommandValidator()
    {
        RuleFor(x => x.CustomerId)
            .NotEmpty();

        RuleFor(x => x.EmployeeId)
            .NotEqual(Guid.Empty)
            .When(x => x.EmployeeId.HasValue);

        RuleFor(x => x.Items)
            .NotEmpty()
            .WithMessage("An order must have at least one item.");

        RuleFor(x => x.Notes)
            .MaximumLength(2000);

        // Refused rather than quietly ignored. Order.CreateFabricSale drops the employee on the
        // floor, so accepting one here would tell the caller a tailor was assigned to a sale that
        // has no work in it — and SealAsSale would then throw on an order already half-built.
        RuleFor(x => x.EmployeeId)
            .Null()
            .When(x => x.IsFabricSale)
            .WithMessage("A fabric sale has no work to assign, so it cannot have an employee.");

        // Cloth sold over the counter is cloth: every line has to say which, and how much of it.
        // Without this a sale could be recorded with a stitching line on it and no fabric at all,
        // which is a tailoring order wearing the wrong status. A sale line carries exactly one cloth
        // — the length being sold — not the several a stitched garment may be cut from.
        RuleForEach(x => x.Items)
            .Must(item => item.Fabrics.Count == 1)
            .When(x => x.IsFabricSale)
            .WithMessage("Every line on a fabric sale must name exactly one cloth being sold.");

        RuleForEach(x => x.Items).SetValidator(new CreateOrderItemInputValidator());
    }
}

public sealed class CreateOrderItemInputValidator : AbstractValidator<CreateOrderItemInput>
{
    public CreateOrderItemInputValidator()
    {
        RuleFor(x => x.GarmentType)
            .MustBeAGarmentName();

        RuleFor(x => x.Quantity)
            .GreaterThan(0)
            .LessThanOrEqualTo(OrderLimits.MaxItemQuantity);

        RuleFor(x => x.UnitPrice)
            .GreaterThan(0);

        RuleForEach(x => x.Fabrics).SetValidator(new CreateOrderItemFabricInputValidator());
    }
}

public sealed class CreateOrderItemFabricInputValidator : AbstractValidator<CreateOrderItemFabricInput>
{
    public CreateOrderItemFabricInputValidator()
    {
        RuleFor(x => x.FabricType)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.Source)
            .IsInEnum();

        RuleFor(x => x.Color)
            .MaximumLength(50);

        RuleFor(x => x.Quantity)
            .GreaterThan(0);

        // Zero is allowed — the legacy "cloth folded into the stitching price" case, and the default.
        // Only a negative rate is a mistake.
        RuleFor(x => x.RatePerMetre)
            .GreaterThanOrEqualTo(0);
    }
}
