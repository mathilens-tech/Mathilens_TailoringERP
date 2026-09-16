using System.Globalization;
using System.Text;

namespace MathilensERP.Api.Common.Export;

/// <summary>
/// Writes one table as RFC 4180 CSV.
///
/// <para>Hand-written rather than taken from a package, for the reason the rest of this codebase
/// gives: the whole of CSV that matters here is the quoting rule below, and a dependency would be
/// the larger change.</para>
/// </summary>
public static class CsvFile
{
    public const string ContentType = "text/csv";

    /// <summary>
    /// UTF-8 <b>with</b> a byte-order mark.
    ///
    /// <para>Excel on Windows reads a BOM-less UTF-8 CSV as the system codepage, so a customer named
    /// "Sethuraman" survives and one named "சேதுராமன்" arrives as mojibake. The BOM is three bytes
    /// that make the difference between a file that opens correctly by double-click and one that
    /// needs the import wizard driven by hand. Everything else that reads CSV tolerates it.</para>
    /// </summary>
    private static readonly UTF8Encoding Utf8WithBom = new(encoderShouldEmitUTF8Identifier: true);

    public static byte[] Write(IReadOnlyList<string> headers, IReadOnlyList<IReadOnlyList<object?>> rows)
    {
        var builder = new StringBuilder();

        builder.AppendLine(string.Join(",", headers.Select(Escape)));

        foreach (var row in rows)
        {
            // Squared off to the headers, so a short row does not shift every later column left and
            // a long one does not add cells with no heading above them.
            var cells = new string[headers.Count];
            for (var i = 0; i < headers.Count; i++)
            {
                cells[i] = Escape(Format(i < row.Count ? row[i] : null));
            }

            builder.AppendLine(string.Join(",", cells));
        }

        return Utf8WithBom.GetBytes(builder.ToString());
    }

    /// <summary>
    /// Quotes a field only when it has to be, and doubles any quote inside it.
    ///
    /// <para>Quoting only when needed keeps the file readable in a text editor, which is half of why
    /// anyone chooses CSV. A newline counts: an order note spanning two lines is legal inside quotes
    /// and corrupts every following row without them.</para>
    /// </summary>
    private static string Escape(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var needsQuotes = value.Contains(',')
            || value.Contains('"')
            || value.Contains('\n')
            || value.Contains('\r')
            // Leading or trailing spaces are silently eaten by some readers otherwise.
            || value != value.Trim();

        return needsQuotes ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
    }

    /// <summary>
    /// Invariant culture throughout, and round-trip format for dates.
    ///
    /// <para>A backup taken on a machine set to a comma decimal separator would otherwise write
    /// 1234,50 into a comma-separated file — one value arriving as two columns. Dates go out as
    /// ISO 8601 for the same reason: 03/04/2026 is two different days depending on who opens it.</para>
    /// </summary>
    private static string Format(object? value) => value switch
    {
        null => string.Empty,
        bool flag => flag ? "Yes" : "No",
        DateTime date => date.ToString("O", CultureInfo.InvariantCulture),
        DateTimeOffset date => date.ToString("O", CultureInfo.InvariantCulture),
        decimal number => number.ToString(CultureInfo.InvariantCulture),
        double number => number.ToString(CultureInfo.InvariantCulture),
        IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString() ?? string.Empty,
    };
}
