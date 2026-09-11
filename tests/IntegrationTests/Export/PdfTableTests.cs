using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using MathilensERP.Api.Common.Export;

namespace MathilensERP.IntegrationTests.Export;

/// <summary>
/// Renders actual PDFs. No fixture and no database — PdfTable is a pure function — but it lives in
/// this project because that is the one that references the Api assembly.
///
/// <para>
/// These exist because every PDF export shipped broken and every test still passed. PDFsharp needs a
/// font resolver registered or it throws while building its own fallback font, and nothing short of
/// rendering a document finds that out: the controllers, the row shaping and the format switch were
/// all correct. A test that stops at "the endpoint returns a file" would have stayed green too, so
/// these assert on the bytes.
/// </para>
/// </summary>
public class PdfTableTests
{
    private static readonly string[] Headers = ["Name", "Phone", "Joined", "Balance", "Active"];

    [Fact]
    public void Write_ProducesAPdf()
    {
        var bytes = PdfTable.Write("Customers", Headers, Rows());

        // A PDF is its header. Asserting on length alone would pass on a truncated or empty file.
        Assert.Equal("%PDF", Encoding.ASCII.GetString(bytes, 0, 4));
    }

    [Fact]
    public void Write_EmbedsTheFont_SoTheFileRendersOnAMachineThatLacksIt()
    {
        var bytes = PdfTable.Write("Customers", Headers, Rows());

        // The whole point of the resolver: the face travels in the document. A PDF that merely
        // references "Noto Sans" would render as squares wherever it is not installed.
        Assert.Contains("FontFile", Encoding.Latin1.GetString(bytes), StringComparison.Ordinal);
    }

    [Fact]
    public void Write_WithBoldHeadings_ResolvesTheBoldFaceRatherThanThrowing()
    {
        // The heading and the header row are bold, so this path is already exercised above — but it
        // is the one that needs a second physical face, and a resolver returning null for bold would
        // fail here and nowhere else.
        var bytes = PdfTable.Write("Customers", Headers, Rows(), "All customers");

        Assert.Equal("%PDF", Encoding.ASCII.GetString(bytes, 0, 4));
    }

    [Fact]
    public void Write_PutsTheTableOnALandscapePage()
    {
        // The column widths are shared out across the page width, so if the page ever comes back
        // portrait — or worse, zero-width, which is what MigraDoc reports when only PageFormat is
        // set — the columns are wrong before a single cell is drawn. That failure printed a page of
        // overlapping text stacked against the left margin and still returned a valid PDF, so it
        // survived every check that stopped at the file being well-formed. Hence asserting the
        // geometry itself.
        var bytes = PdfTable.Write("Customers", Headers, Rows());

        var mediaBox = Regex.Match(Encoding.Latin1.GetString(bytes), @"/MediaBox\[0 0 ([\d.]+) ([\d.]+)\]");
        Assert.True(mediaBox.Success, "The page has no MediaBox, so its size cannot be established.");

        var width = double.Parse(mediaBox.Groups[1].Value, CultureInfo.InvariantCulture);
        var height = double.Parse(mediaBox.Groups[2].Value, CultureInfo.InvariantCulture);

        // A4's long edge across, to two decimal places of a point.
        Assert.Equal(841.89, width, 1);
        Assert.Equal(595.28, height, 1);
        Assert.True(width > height, "The page is portrait; the rightmost columns will fall off it.");
    }

    [Fact]
    public void Write_WithNoRows_StillProducesAPdf()
    {
        // An export of an empty list is a normal thing to ask for, and a table with no body rows is
        // the kind of edge MigraDoc is entitled to dislike.
        var bytes = PdfTable.Write("Customers", Headers, []);

        Assert.Equal("%PDF", Encoding.ASCII.GetString(bytes, 0, 4));
    }

    [Fact]
    public void Write_WithMoreCellsThanHeaders_IgnoresTheExtras()
    {
        IReadOnlyList<IReadOnlyList<object?>> rows =
        [
            ["Priya", "9876543210", new DateOnly(2026, 3, 1), 1250.5m, true, "surplus"],
        ];

        var bytes = PdfTable.Write("Customers", Headers, rows);

        Assert.Equal("%PDF", Encoding.ASCII.GetString(bytes, 0, 4));
    }

    private static IReadOnlyList<IReadOnlyList<object?>> Rows() =>
    [
        ["Priya", "9876543210", new DateOnly(2026, 3, 1), 1250.5m, true],
        ["Arun", "9123456780", new DateTime(2026, 4, 2), 0m, false],
        // Nulls reach Format() as an empty cell, and a short row must not index past its end.
        ["Meera", null, null, null, null],
        [],
    ];
}
