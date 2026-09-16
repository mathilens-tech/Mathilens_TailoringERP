namespace MathilensERP.Api.Common.Export;

/// <summary>
/// Which file the whole-shop backup should come down as.
///
/// <para>Separate from <see cref="ExportFormat"/> rather than an extension of it, deliberately. That
/// enum is what six per-screen Export buttons already send, and <see cref="ExportResultFactory"/>
/// treats anything that is not Pdf as Xlsx — so adding members there would have those six endpoints
/// silently answer a request for CSV with a spreadsheet. A backup is also a different kind of thing:
/// it carries many tables where those carry one, which is what JSON and the zip exist to hold.</para>
/// </summary>
public enum BackupFormat
{
    /// <summary>
    /// Every table in one structured file, and the only format here that keeps the data's shape —
    /// types survive, nothing is flattened to text, and a future restore has something to read.
    /// </summary>
    Json = 0,

    /// <summary>One workbook, one sheet per table. For reading and working on, not for restoring.</summary>
    Xlsx = 1,

    /// <summary>
    /// A zip holding one CSV per table, because a CSV file holds exactly one table and a backup is
    /// about ten. Loose CSVs would be ten downloads nobody keeps together.
    /// </summary>
    Csv = 2,

    /// <summary>
    /// A printable document, one section per table. For filing and handing over — the least
    /// machine-readable of the four, and no use at all for getting data back in.
    /// </summary>
    Pdf = 3,
}
