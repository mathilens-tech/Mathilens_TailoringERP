using MigraDoc.DocumentObjectModel;
using MigraDoc.DocumentObjectModel.Tables;
using MigraDoc.Rendering;
using PdfSharp.Fonts;

namespace MathilensERP.Api.Common.Export;

/// <summary>
/// Renders the same header-and-rows shape <see cref="Excel.ExcelSheet"/> writes, as a PDF.
///
/// Lives in the API layer for the same reason the spreadsheet writer does: PDF is a transport
/// format like JSON, so Application keeps dealing in plain row records and never references a
/// document library (01_ARCHITECTURE.md § 9.1).
///
/// Landscape by default. These are list exports, and a shop's customer table has more columns than
/// fit across a portrait page — a portrait default would silently squeeze every column to
/// illegibility rather than fail, which is the worse outcome.
/// </summary>
public static class PdfTable
{
    public const string ContentType = "application/pdf";

    private static readonly Unit A4ShortEdge = Unit.FromCentimeter(21);
    private static readonly Unit A4LongEdge = Unit.FromCentimeter(29.7);
    private static readonly Unit CellPadding = Unit.FromPoint(3);
    private static readonly Color GridLine = new(205, 205, 205);
    private static readonly Color RowBand = new(246, 246, 246);

    /// <summary>
    /// Narrow enough that a column of "Yes" does not claim a quarter of the page, wide enough that a
    /// heading is not broken across three lines.
    /// </summary>
    private const int MinColumnChars = 7;

    /// <summary>
    /// One rambling note must not starve every other column. Past this the text wraps instead, which
    /// costs vertical space that is cheap rather than horizontal space that is not.
    /// </summary>
    private const int MaxColumnChars = 34;

    /// <summary>
    /// Registers the font resolver before anything can ask for a glyph. It lives here rather than in
    /// <c>Program.cs</c> because PDFsharp reads it from a global, and a global that some other entry
    /// point forgets to populate is a crash at render time — this way the only class that renders a
    /// PDF is the one that guarantees the setting. The null check matters: PDFsharp rejects a second
    /// assignment once a font has been created.
    /// </summary>
    static PdfTable()
    {
        GlobalFontSettings.FontResolver ??= new EmbeddedFontResolver();
    }

    public static byte[] Write(
        string title,
        IReadOnlyList<string> headers,
        IEnumerable<IReadOnlyList<object?>> rows,
        string? subtitle = null)
    {
        var document = new Document();
        document.Info.Title = title;

        // Named honestly: this is the face that is actually embedded. Asking for "Arial" would still
        // render — the resolver substitutes whatever it is handed — but the document would then
        // claim a font it does not contain.
        var style = document.Styles[StyleNames.Normal]!;
        style.Font.Name = EmbeddedFontResolver.FamilyName;
        style.Font.Size = 8;

        var section = document.AddSection();

        // A4 landscape, stated as the dimensions themselves. Two MigraDoc behaviours force this:
        // PageFormat.A4 alone leaves PageWidth and PageHeight at zero until render time — the column
        // arithmetic below reads them well before that, and was dividing a *negative* width across
        // the columns, stacking every export into an unreadable pile against the left margin — and
        // PageSetup.Orientation is then ignored outright once both dimensions are set explicitly,
        // so asking for Landscape as well printed a portrait page with the last column off the edge.
        // The long edge across is what Landscape means; saying so directly leaves nothing to infer.
        section.PageSetup.PageWidth = A4LongEdge;
        section.PageSetup.PageHeight = A4ShortEdge;
        section.PageSetup.TopMargin = Unit.FromCentimeter(1.2);
        section.PageSetup.BottomMargin = Unit.FromCentimeter(1.2);
        section.PageSetup.LeftMargin = Unit.FromCentimeter(1);
        section.PageSetup.RightMargin = Unit.FromCentimeter(1);

        // These are printed and filed, so a loose page has to say where it belongs.
        var footer = section.Footers.Primary.AddParagraph();
        footer.AddText("Page ");
        footer.AddPageField();
        footer.AddText(" of ");
        footer.AddNumPagesField();
        footer.Format.Alignment = ParagraphAlignment.Right;
        footer.Format.Font.Size = 7;
        footer.Format.Font.Color = Colors.Gray;

        var heading = section.AddParagraph(title);
        heading.Format.Font.Size = 14;
        heading.Format.Font.Bold = true;
        heading.Format.SpaceAfter = Unit.FromPoint(2);

        // What the reader needs to know to trust the numbers: which period, and when it was taken.
        // A printed report with no date on it is worse than no report.
        var stamp = subtitle is null
            ? $"Generated {DateTime.UtcNow:dd MMM yyyy HH:mm} UTC"
            : $"{subtitle} · generated {DateTime.UtcNow:dd MMM yyyy HH:mm} UTC";
        var stampParagraph = section.AddParagraph(stamp);
        stampParagraph.Format.Font.Size = 7;
        stampParagraph.Format.Font.Color = Colors.Gray;
        stampParagraph.Format.SpaceAfter = Unit.FromPoint(8);

        var table = section.AddTable();
        table.Borders.Width = 0.5;
        table.Borders.Color = GridLine;

        // Read once and squared off to the header count, because the widths below are measured from
        // the content and a stream can only be walked the once.
        var body = new List<object?[]>();
        foreach (var row in rows)
        {
            var cells = new object?[headers.Count];
            for (var i = 0; i < headers.Count; i++)
            {
                cells[i] = i < row.Count ? row[i] : null;
            }

            body.Add(cells);
        }

        // Landscape swaps the edges, so the usable width comes off the long one.
        var usable = A4LongEdge.Point
            - section.PageSetup.LeftMargin.Point
            - section.PageSetup.RightMargin.Point;

        foreach (var width in MeasureColumns(headers, body, usable))
        {
            var column = table.AddColumn(Unit.FromPoint(width));
            // Without padding the text sits flush against the rules and the grid reads as noise.
            column.LeftPadding = CellPadding;
            column.RightPadding = CellPadding;
        }

        var headerRow = table.AddRow();
        headerRow.HeadingFormat = true; // Repeats on every page — a table whose second page has no headers is unreadable.
        headerRow.Shading.Color = Colors.WhiteSmoke;
        headerRow.Format.Font.Bold = true;
        headerRow.TopPadding = CellPadding;
        headerRow.BottomPadding = CellPadding;

        for (var i = 0; i < headers.Count; i++)
        {
            headerRow.Cells[i].AddParagraph(headers[i]);
            headerRow.Cells[i].VerticalAlignment = VerticalAlignment.Center;
        }

        for (var r = 0; r < body.Count; r++)
        {
            var documentRow = table.AddRow();
            documentRow.TopPadding = CellPadding;
            documentRow.BottomPadding = CellPadding;

            // Banding, because a wide landscape row is easy to lose your place in halfway across.
            if (r % 2 == 1)
            {
                documentRow.Shading.Color = RowBand;
            }

            for (var i = 0; i < headers.Count; i++)
            {
                var value = body[r][i];
                var cell = documentRow.Cells[i];
                cell.AddParagraph(Format(value));
                cell.VerticalAlignment = VerticalAlignment.Center;

                // Money and counts line up on their last digit or they cannot be compared down the
                // column, which is most of what a column of numbers is for.
                if (value is decimal or int or long or double)
                {
                    cell.Format.Alignment = ParagraphAlignment.Right;
                }
            }
        }

        var renderer = new PdfDocumentRenderer { Document = document };
        renderer.RenderDocument();

        using var stream = new MemoryStream();
        renderer.PdfDocument.Save(stream);
        return stream.ToArray();
    }

    /// <summary>
    /// Shares the page out in proportion to what each column actually holds, clamped at both ends.
    ///
    /// Even columns were the old behaviour and they read badly: a ten-digit phone number was given
    /// the same width as a full postal address, so one column sat half empty while its neighbour
    /// wrapped onto four lines. Character counts are a rough proxy for width in a proportional
    /// font — good enough to allocate space, and far better than ignoring the content entirely.
    /// </summary>
    private static double[] MeasureColumns(
        IReadOnlyList<string> headers,
        IReadOnlyList<object?[]> body,
        double usable)
    {
        var weights = new double[headers.Count];

        for (var i = 0; i < headers.Count; i++)
        {
            var longest = headers[i].Length;
            foreach (var cells in body)
            {
                longest = Math.Max(longest, Format(cells[i]).Length);
            }

            weights[i] = Math.Clamp(longest, MinColumnChars, MaxColumnChars);
        }

        // Guarded rather than assumed: an export with no columns would divide by zero here, and
        // "the table came out empty" is a better outcome than a 500 on an empty screen.
        var total = weights.Sum();
        if (total <= 0)
        {
            return [.. weights.Select(_ => usable / Math.Max(headers.Count, 1))];
        }

        return [.. weights.Select(weight => usable * weight / total)];
    }

    /// <summary>
    /// Dates as days and numbers with two decimals, because this is read by a person rather than
    /// parsed. MigraDoc takes strings only, so nulls become an empty cell rather than "null".
    /// </summary>
    private static string Format(object? value) => value switch
    {
        null => string.Empty,
        DateOnly date => date.ToString("dd MMM yyyy"),
        DateTime dateTime => dateTime.ToString("dd MMM yyyy"),
        decimal number => number.ToString("N2"),
        bool flag => flag ? "Yes" : "No",
        _ => value.ToString() ?? string.Empty,
    };
}
