using FluentValidation;

namespace MathilensERP.Application.Pricing.Commands.Import;

/// <summary>
/// Guards the request as a whole only — individual rows are validated per row by
/// <see cref="ImportClothPricesCommandHandler"/> so one bad row cannot reject the whole upload.
/// </summary>
public sealed class ImportClothPricesCommandValidator : AbstractValidator<ImportClothPricesCommand>
{
    public ImportClothPricesCommandValidator()
    {
        RuleFor(x => x.Rows)
            .NotEmpty()
            .WithMessage("The spreadsheet contains no data rows.");
    }
}
