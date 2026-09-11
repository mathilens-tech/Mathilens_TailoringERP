namespace MathilensERP.Api.Common.Excel;

public static class ImportLimits
{
    /// <summary>
    /// Master-data sheets are a few columns wide; 10 MB is far more than a realistic customer or
    /// price list and keeps an accidental upload of something else from being read into memory.
    /// </summary>
    public const long MaxFileBytes = 10 * 1024 * 1024;
}
