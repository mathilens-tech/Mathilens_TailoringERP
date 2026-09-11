namespace MathilensERP.Application.Common;

/// <summary>
/// The outcome of a spreadsheet import. Imports are deliberately partial-success: a typo in
/// one row must not cost the operator the other 499 good rows, so every row is attempted and
/// the failures come back addressed by their spreadsheet row number for correction and re-upload.
/// </summary>
public sealed record ImportResultDto(int Created, int Updated, IReadOnlyList<ImportRowErrorDto> Errors)
{
    public int Failed => Errors.Count;
}

/// <param name="RowNumber">The 1-based row number in the uploaded sheet, header included, so it matches what the operator sees in Excel.</param>
public sealed record ImportRowErrorDto(int RowNumber, string Message);
