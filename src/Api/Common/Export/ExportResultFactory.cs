using MathilensERP.Api.Common.Excel;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Common.Export;

/// <summary>
/// Turns a header-and-rows table into whichever file the caller asked for.
///
/// Every export endpoint goes through here, so a screen gains PDF by passing its existing rows —
/// no endpoint decides for itself what a spreadsheet or a document should look like, and the two
/// can never drift into disagreeing about the columns.
/// </summary>
public static class ExportResultFactory
{
    public static FileContentResult Create(
        ExportFormat format,
        string title,
        string fileNameStem,
        IReadOnlyList<string> headers,
        IReadOnlyList<IReadOnlyList<object?>> rows,
        string? subtitle = null)
    {
        // Dated, so a folder of exports taken over a month sorts and reads sensibly instead of
        // being a pile of files with the same name and a browser-appended "(3)".
        var stamp = DateTime.UtcNow.ToString("yyyyMMdd");

        return format == ExportFormat.Pdf
            ? new FileContentResult(PdfTable.Write(title, headers, rows, subtitle), PdfTable.ContentType)
            {
                FileDownloadName = $"{fileNameStem}-{stamp}.pdf",
            }
            : new FileContentResult(ExcelSheet.Write(title, headers, rows), ExcelSheet.ContentType)
            {
                FileDownloadName = $"{fileNameStem}-{stamp}.xlsx",
            };
    }
}
