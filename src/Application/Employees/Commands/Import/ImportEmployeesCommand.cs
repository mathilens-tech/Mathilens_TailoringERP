using MathilensERP.Application.Common;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Commands.Import;

public sealed record ImportEmployeesCommand(IReadOnlyList<EmployeeImportRow> Rows) : ICommand<Result<ImportResultDto>>;

/// <param name="RowNumber">The row's position in the uploaded sheet, so failures can be reported where the operator can find them.</param>
/// <param name="Id">Set when the row came from an export round-trip; matched ahead of <paramref name="EmployeeCode"/>.</param>
public sealed record EmployeeImportRow(
    int RowNumber,
    Guid? Id,
    string EmployeeCode,
    string FullName,
    string? JobTitle,
    string PhoneNumber,
    string? Email);
