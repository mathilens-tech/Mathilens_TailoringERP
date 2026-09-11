using ClosedXML.Excel;

namespace MathilensERP.Api.Common.Excel;

/// <summary>
/// Reads and writes the single-sheet, header-row spreadsheets the master-data screens import
/// and export. Lives in the API layer on purpose: xlsx is a transport format, the same as JSON,
/// so Application keeps dealing in plain row records and never references a spreadsheet library
/// (01_ARCHITECTURE.md § 9.1).
/// </summary>
public static class ExcelSheet
{
    public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    /// <summary>Writes <paramref name="rows"/> under <paramref name="headers"/> and returns the .xlsx bytes.</summary>
    public static byte[] Write(string sheetName, IReadOnlyList<string> headers, IEnumerable<IReadOnlyList<object?>> rows)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet(sheetName);

        for (var column = 0; column < headers.Count; column++)
        {
            sheet.Cell(1, column + 1).Value = headers[column];
        }

        sheet.Row(1).Style.Font.Bold = true;
        sheet.SheetView.FreezeRows(1);

        var rowNumber = 2;
        foreach (var row in rows)
        {
            for (var column = 0; column < row.Count; column++)
            {
                sheet.Cell(rowNumber, column + 1).Value = XLCellValue.FromObject(row[column]);
            }

            rowNumber++;
        }

        sheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    /// <summary>
    /// Reads the first worksheet into one <see cref="ExcelRow"/> per data row, keyed by the
    /// header text so column order in the uploaded file doesn't have to match the export's.
    /// </summary>
    /// <exception cref="InvalidDataException">The file isn't a readable workbook, or has no header row.</exception>
    public static IReadOnlyList<ExcelRow> Read(Stream stream)
    {
        XLWorkbook workbook;
        try
        {
            workbook = new XLWorkbook(stream);
        }
        catch (Exception ex)
        {
            throw new InvalidDataException("The file could not be read as an Excel workbook (.xlsx).", ex);
        }

        using (workbook)
        {
            var sheet = workbook.Worksheets.FirstOrDefault()
                ?? throw new InvalidDataException("The workbook contains no worksheets.");

            var used = sheet.RangeUsed();
            if (used is null)
            {
                throw new InvalidDataException("The worksheet is empty.");
            }

            var headerRow = used.FirstRow();
            var columnsByHeader = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var cell in headerRow.Cells())
            {
                var header = cell.GetString().Trim();
                if (header.Length > 0)
                {
                    // First occurrence wins, so a stray duplicate header can't shadow the real column.
                    columnsByHeader.TryAdd(header, cell.Address.ColumnNumber);
                }
            }

            if (columnsByHeader.Count == 0)
            {
                throw new InvalidDataException("The first row must contain column headers.");
            }

            var rows = new List<ExcelRow>();
            foreach (var row in used.Rows().Skip(1))
            {
                // Excel hands back trailing blank rows for any cell that was ever touched; they
                // are not data, and reporting them as invalid rows would be noise.
                if (row.IsEmpty())
                {
                    continue;
                }

                rows.Add(new ExcelRow(row.RowNumber(), columnsByHeader, row));
            }

            return rows;
        }
    }
}
