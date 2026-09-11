using MathilensERP.Application.Common;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Commands.Import;

public sealed record ImportCustomersCommand(IReadOnlyList<CustomerImportRow> Rows) : ICommand<Result<ImportResultDto>>;

/// <param name="RowNumber">The row's position in the uploaded sheet, so failures can be reported where the operator can find them.</param>
/// <param name="Id">Set when the row came from an export round-trip; matched ahead of <paramref name="PhoneNumber"/>.</param>
public sealed record CustomerImportRow(
    int RowNumber,
    Guid? Id,
    string FullName,
    string PhoneNumber,
    string? Email,
    string? Address,
    string? Notes);
