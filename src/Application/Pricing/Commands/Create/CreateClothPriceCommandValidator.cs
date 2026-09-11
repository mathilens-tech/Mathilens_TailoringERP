using FluentValidation;

namespace MathilensERP.Application.Pricing.Commands.Create;

public sealed class CreateClothPriceCommandValidator : AbstractValidator<CreateClothPriceCommand>
{
    public CreateClothPriceCommandValidator()
    {
        RuleFor(x => x.ClothCode)
            .NotEmpty()
            .MaximumLength(50);

        RuleFor(x => x.ClothName)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.CostPrice)
            .GreaterThan(0);

        RuleFor(x => x.SellingPrice)
            .GreaterThan(0);
    }
}
