namespace MathilensERP.Api.Common.Export;

/// <summary>Which file a screen's Export button should produce.</summary>
public enum ExportFormat
{
    /// <summary>A spreadsheet, for work that continues after the download — filtering, totals, re-import.</summary>
    Xlsx = 0,

    /// <summary>A document, for work that ends at the download — printing, filing, handing to someone.</summary>
    Pdf = 1,
}
