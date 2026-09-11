using FluentValidation;

namespace MathilensERP.Application.Customers.Commands.Import;

/// <summary>
/// Guards the request as a whole only. Individual rows are deliberately not validated here —
/// a failing rule would reject the entire upload, where an import is expected to apply the
/// good rows and report the bad ones by row number (see <see cref="ImportCustomersCommandHandler"/>).
/// </summary>
public sealed class ImportCustomersCommandValidator : AbstractValidator<ImportCustomersCommand>
{
    public ImportCustomersCommandValidator()
    {
        RuleFor(x => x.Rows)
            .NotEmpty()
            .WithMessage("The spreadsheet contains no data rows.");
    }
}
