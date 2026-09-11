using FluentValidation;

namespace MathilensERP.Application.Employees.Commands.Import;

/// <summary>
/// Guards the request as a whole only — individual rows are validated per row by
/// <see cref="ImportEmployeesCommandHandler"/> so one bad row cannot reject the whole upload.
/// </summary>
public sealed class ImportEmployeesCommandValidator : AbstractValidator<ImportEmployeesCommand>
{
    public ImportEmployeesCommandValidator()
    {
        RuleFor(x => x.Rows)
            .NotEmpty()
            .WithMessage("The spreadsheet contains no data rows.");
    }
}
