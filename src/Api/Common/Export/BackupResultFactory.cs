using MathilensERP.Api.Common.Excel;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Common.Export;

/// <summary>
/// Turns the gathered tables into whichever backup file was asked for.
///
/// <para>The counterpart to <see cref="ExportResultFactory"/> for the many-table case. One place
/// decides the filename and the content type for all four formats, so a backup cannot arrive as a
/// zip named .xlsx.</para>
/// </summary>
public static class BackupResultFactory
{
    public static FileContentResult Create(BackupFormat format, IReadOnlyList<ExportTable> tables)
    {
        // Dated and timed, unlike the per-screen exports' date alone: a shop taking a backup before
        // and after a day's work wants two files, not one that silently replaces the other.
        var stamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmm");

        return format switch
        {
            BackupFormat.Json => new FileContentResult(BackupArchive.WriteJson(tables), BackupArchive.JsonContentType)
            {
                FileDownloadName = $"mathilens-backup-{stamp}.json",
            },
            BackupFormat.Csv => new FileContentResult(BackupArchive.WriteCsvZip(tables), BackupArchive.ZipContentType)
            {
                FileDownloadName = $"mathilens-backup-{stamp}.zip",
            },
            BackupFormat.Pdf => new FileContentResult(PdfTable.WriteMany("Mathilens backup", tables), PdfTable.ContentType)
            {
                FileDownloadName = $"mathilens-backup-{stamp}.pdf",
            },
            _ => new FileContentResult(ExcelWorkbook.Write(tables), ExcelWorkbook.ContentType)
            {
                FileDownloadName = $"mathilens-backup-{stamp}.xlsx",
            },
        };
    }
}
