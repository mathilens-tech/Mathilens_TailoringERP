using MathilensERP.Application.Common;

namespace MathilensERP.Application.Customers.Commands.Import;

/// <summary>
/// What an upload would do, worked out without doing it — shown before the operator commits.
///
/// <para>An import silently merging two people because a sheet reused a phone number is only
/// discoverable afterwards, by which point the two records are one. This is the chance to notice.</para>
/// </summary>
public sealed record CustomerImportPreviewDto(
    int TotalRows,
    int WillCreate,
    int WillUpdate,
    IReadOnlyList<ImportRowErrorDto> Errors,
    IReadOnlyList<CustomerImportDuplicateDto> Duplicates)
{
    public int WillFail => Errors.Count;
}

/// <param name="RowNumber">Where to find it in the uploaded sheet, header included.</param>
/// <param name="Reason">One sentence naming who the row collides with and what happens to it.</param>
public sealed record CustomerImportDuplicateDto(int RowNumber, string Name, string PhoneNumber, string Reason);
