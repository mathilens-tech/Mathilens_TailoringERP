using ClosedXML.Excel;
using MathilensERP.Api.Common.Export;

namespace MathilensERP.Api.Common.Excel;

/// <summary>
/// Several tables as one workbook, a sheet apiece.
///
/// <para>Beside <see cref="ExcelSheet"/> rather than folded into it: that writer serves the
/// single-table exports the master-data screens produce and its signature says so. A backup is many
/// tables at once, and giving the one-table case an optional list of extra tables would make every
/// existing caller read as though it might be writing more than one.</para>
/// </summary>
public static class ExcelWorkbook
{
    public const string ContentType = ExcelSheet.ContentType;

    /// <summary>
    /// Excel's own limit on a sheet name, and it is a hard one — a longer name is not truncated,
    /// it is rejected, and the workbook fails to save rather than opening with an odd tab.
    /// </summary>
    private const int MaxSheetNameLength = 31;

    public static byte[] Write(IReadOnlyList<ExportTable> tables)
    {
        using var workbook = new XLWorkbook();

        foreach (var table in tables)
        {
            var sheet = workbook.AddWorksheet(SheetName(table.Name, workbook));

            for (var column = 0; column < table.Headers.Count; column++)
            {
                sheet.Cell(1, column + 1).Value = table.Headers[column];
            }

            sheet.Row(1).Style.Font.Bold = true;
            sheet.SheetView.FreezeRows(1);

            var rowNumber = 2;
            foreach (var row in table.Rows)
            {
                for (var column = 0; column < row.Count; column++)
                {
                    sheet.Cell(rowNumber, column + 1).Value = XLCellValue.FromObject(row[column]);
                }

                rowNumber++;
            }

            // Only when there is something to measure. AdjustToContents on an empty sheet walks
            // every column Excel believes exists, which is slow for no gain.
            if (rowNumber > 2)
            {
                sheet.Columns().AdjustToContents();
            }
        }

        // A workbook with no sheets is not a valid xlsx and ClosedXML throws on save. A backup of a
        // brand-new shop is a real case, so it gets a sheet saying so rather than a 500.
        if (!workbook.Worksheets.Any())
        {
            workbook.AddWorksheet("Backup").Cell(1, 1).Value = "There is nothing to export yet.";
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    /// <summary>
    /// A name Excel will accept, and one no other sheet in this workbook already has.
    ///
    /// <para>Excel forbids : \ / ? * [ ] in a sheet name and rejects duplicates outright. Neither can
    /// arise from the fixed table names this ships with — both are guarded anyway, because the cost
    /// is a few lines and the failure is a workbook that will not save at all.</para>
    /// </summary>
    private static string SheetName(string name, XLWorkbook workbook)
    {
        var cleaned = new string(name.Select(c => "\\/?*[]:".Contains(c) ? '-' : c).ToArray());
        if (cleaned.Length > MaxSheetNameLength)
        {
            cleaned = cleaned[..MaxSheetNameLength];
        }

        var candidate = cleaned;
        var suffix = 2;
        while (workbook.Worksheets.Any(sheet => sheet.Name.Equals(candidate, StringComparison.OrdinalIgnoreCase)))
        {
            var tail = $" ({suffix++})";
            candidate = cleaned.Length + tail.Length > MaxSheetNameLength
                ? cleaned[..(MaxSheetNameLength - tail.Length)] + tail
                : cleaned + tail;
        }

        return candidate;
    }
}
