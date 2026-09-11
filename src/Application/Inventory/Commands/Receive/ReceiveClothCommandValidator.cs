using FluentValidation;

namespace MathilensERP.Application.Inventory.Commands.Receive;

public sealed class ReceiveClothCommandValidator : AbstractValidator<ReceiveClothCommand>
{
    public ReceiveClothCommandValidator()
    {
        RuleFor(x => x.ClothPriceId)
            .NotEmpty()
            .WithMessage("Choose the cloth that was received.");

        RuleFor(x => x.Quantity)
            .GreaterThan(0)
            .WithMessage("Quantity must be greater than zero.");

        RuleFor(x => x.Unit)
            .IsInEnum();

        RuleFor(x => x.ReceivedOn)
            .NotEqual(default(DateOnly))
            .WithMessage("Enter the date the cloth was received.");

        // Zero is a real rate — free samples happen — so only negatives are refused.
        RuleFor(x => x.RatePerUnit)
            .GreaterThanOrEqualTo(0)
            .When(x => x.RatePerUnit.HasValue);

        RuleFor(x => x.SupplierName)
            .MaximumLength(200);

        RuleFor(x => x.InvoiceNumber)
            .MaximumLength(50);

        RuleFor(x => x.Notes)
            .MaximumLength(1000);
    }
}
