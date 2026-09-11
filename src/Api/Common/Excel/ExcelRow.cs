using System.Globalization;
using ClosedXML.Excel;

namespace MathilensERP.Api.Common.Excel;

/// <summary>
/// One data row of an uploaded sheet, addressed by header name. Cell values are materialised
/// into <see cref="XLCellValue"/> (a struct) at construction so a row stays readable after the
/// workbook it came from has been disposed.
///
/// The getters are deliberately lenient — a cell that can't be parsed comes back as the type's
/// default rather than throwing. Rejecting it here would mean the API layer inventing its own
/// error messages; instead the empty/zero value falls through to the Application row validator,
/// which is the single place import and form errors are worded.
/// </summary>
public sealed class ExcelRow
{
    private readonly Dictionary<string, XLCellValue> _cells = new(StringComparer.OrdinalIgnoreCase);

    internal ExcelRow(int rowNumber, Dictionary<string, int> columnsByHeader, IXLRangeRow row)
    {
        RowNumber = rowNumber;

        foreach (var (header, columnNumber) in columnsByHeader)
        {
            _cells[header] = row.Worksheet.Cell(rowNumber, columnNumber).Value;
        }
    }

    /// <summary>The 1-based worksheet row number, matching what the operator sees in Excel.</summary>
    public int RowNumber { get; }

    /// <summary>The trimmed cell text, or <c>null</c> when the cell is absent or blank.</summary>
    public string? GetString(string header)
    {
        if (!_cells.TryGetValue(header, out var value) || value.IsBlank)
        {
            return null;
        }

        var text = value.ToString().Trim();
        return text.Length == 0 ? null : text;
    }

    /// <summary>The trimmed cell text, or the empty string — for required columns, whose emptiness the row validator reports.</summary>
    public string GetRequiredString(string header) => GetString(header) ?? string.Empty;

    /// <summary>The cell as a decimal, or 0 when blank or unparseable — which the row validator reports.</summary>
    public decimal GetDecimal(string header)
    {
        if (!_cells.TryGetValue(header, out var value))
        {
            return 0m;
        }

        if (value.IsNumber)
        {
            return (decimal)value.GetNumber();
        }

        return decimal.TryParse(GetString(header), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0m;
    }

    /// <summary>The cell as a Guid, or <c>null</c> when blank or unparseable — treated as "no id supplied".</summary>
    public Guid? GetGuid(string header) =>
        Guid.TryParse(GetString(header), out var parsed) ? parsed : null;
}
