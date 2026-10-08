using MathilensERP.Application.Reports.Queries.MeasurementBackup;
using MigraDoc.DocumentObjectModel;
using MigraDoc.DocumentObjectModel.Tables;
using MigraDoc.Rendering;
using PdfSharp.Fonts;

namespace MathilensERP.Api.Common.Export;

/// <summary>
/// The whole-shop measurement backup as a printable PDF, laid out as a document a shop would file:
/// a titled header, an index of every customer against the page their measurements land on, then a
/// section each with the garments as plain two-column tables.
///
/// <para>Hand-built with MigraDoc rather than the tabular <see cref="PdfTable"/>, because this is a
/// document with a cover, an index whose page numbers resolve to where each customer actually lands
/// (MigraDoc bookmarks and page-reference fields), and a per-customer block — not a single table.
/// It stays in the API layer for the same reason PdfTable does: PDF is a transport format, and
/// Application never references a document library (01_ARCHITECTURE.md § 9.1).</para>
///
/// <para>This class only presents what it is handed. It never changes, reorders, renames or
/// reformats a measurement value — the figures, labels, garments and the customer order all arrive
/// decided by <see cref="GetMeasurementBackupReportQueryHandler"/> and are drawn as given.</para>
/// </summary>
public static class MeasurementBackupPdf
{
    public const string ContentType = "application/pdf";

    // One restrained accent (the app's own --primary, #2563eb) against dark text on white, with a
    // pair of near-whites for the header bands and hairline borders. No second colour, no gradients.
    private static readonly Color Accent = new(37, 99, 235);
    private static readonly Color Ink = new(31, 41, 55);
    private static readonly Color Muted = new(107, 114, 128);
    private static readonly Color Line = new(229, 231, 235);
    private static readonly Color HeaderFill = new(243, 244, 246);
    private static readonly Color SectionFill = new(241, 245, 253);

    private static readonly Unit PageWidthA4 = Unit.FromCentimeter(21);
    private static readonly Unit PageHeightA4 = Unit.FromCentimeter(29.7);
    private static readonly Unit LeftMargin = Unit.FromCentimeter(1.8);
    private static readonly Unit RightMargin = Unit.FromCentimeter(1.8);
    private static readonly Unit UsableWidth = Unit.FromCentimeter(21 - 3.6);

    static MeasurementBackupPdf()
    {
        GlobalFontSettings.FontResolver ??= new EmbeddedFontResolver();
    }

    public static byte[] Write(string shopName, IReadOnlyList<CustomerMeasurementsDto> customers)
    {
        var document = new Document();
        document.Info.Title = $"{shopName} — Customer Measurement Backup";

        var normal = document.Styles[StyleNames.Normal]!;
        normal.Font.Name = EmbeddedFontResolver.FamilyName;
        normal.Font.Size = 9;
        normal.Font.Color = Ink;

        var section = document.AddSection();
        section.PageSetup.PageWidth = PageWidthA4;
        section.PageSetup.PageHeight = PageHeightA4;
        section.PageSetup.TopMargin = Unit.FromCentimeter(1.6);
        section.PageSetup.BottomMargin = Unit.FromCentimeter(1.6);
        section.PageSetup.LeftMargin = LeftMargin;
        section.PageSetup.RightMargin = RightMargin;

        AddFooter(section, shopName);
        AddHeaderAndIndex(section, shopName, customers);

        // The measurements start on their own page, so the header-and-index reads as a cover that
        // can be glanced at or printed alone.
        section.AddPageBreak();

        for (var i = 0; i < customers.Count; i++)
        {
            AddCustomer(section, customers[i], i, isFirst: i == 0);
        }

        if (customers.Count == 0)
        {
            var empty = section.AddParagraph("No customers on file yet.");
            empty.Format.Font.Color = Muted;
        }

        return Render(document);
    }

    private static void AddFooter(Section section, string shopName)
    {
        // One subtle line: the document named on the left, the page on the right. A right tab stop
        // at the page edge pins the page number there without a second paragraph.
        var footer = section.Footers.Primary.AddParagraph();
        footer.Format.AddTabStop(UsableWidth, TabAlignment.Right);
        footer.Format.Font.Size = 7.5;
        footer.Format.Font.Color = Muted;
        footer.Format.Borders.Top.Width = 0.5;
        footer.Format.Borders.Top.Color = Line;
        footer.Format.Borders.Distance = Unit.FromPoint(4);
        footer.AddText($"{shopName} · Customer Measurement Backup");
        footer.AddTab();
        footer.AddText("Page ");
        footer.AddPageField();
        footer.AddText(" of ");
        footer.AddNumPagesField();
    }

    private static void AddHeaderAndIndex(Section section, string shopName, IReadOnlyList<CustomerMeasurementsDto> customers)
    {
        var logo = LogoBase64();
        if (logo is not null)
        {
            var logoParagraph = section.AddParagraph();
            logoParagraph.Format.Alignment = ParagraphAlignment.Center;
            logoParagraph.Format.SpaceAfter = Unit.FromPoint(8);
            var image = logoParagraph.AddImage("base64:" + logo);
            image.LockAspectRatio = true;
            image.Width = Unit.FromCentimeter(3.2);
        }

        // The wordmark is the strongest thing on the page — the shop's name, set large. The title
        // sits under it, then a single quiet metadata line: a count and a date, no time, no UTC.
        var wordmark = section.AddParagraph(shopName.ToUpperInvariant());
        wordmark.Format.Alignment = ParagraphAlignment.Center;
        wordmark.Format.Font.Size = 22;
        wordmark.Format.Font.Bold = true;
        wordmark.Format.SpaceAfter = Unit.FromPoint(1);

        var title = section.AddParagraph("Customer Measurement Backup");
        title.Format.Alignment = ParagraphAlignment.Center;
        title.Format.Font.Size = 12.5;
        title.Format.Font.Color = Muted;
        title.Format.SpaceAfter = Unit.FromPoint(3);

        var meta = section.AddParagraph($"{customers.Count} {(customers.Count == 1 ? "Customer" : "Customers")} · Generated {DateTime.UtcNow:dd MMM yyyy}");
        meta.Format.Alignment = ParagraphAlignment.Center;
        meta.Format.Font.Size = 8.5;
        meta.Format.Font.Color = Muted;

        // A thin accent rule closes the header off from the index — the one place the accent is a
        // line rather than text.
        var rule = section.AddParagraph();
        rule.Format.Borders.Bottom.Width = 1;
        rule.Format.Borders.Bottom.Color = Accent;
        rule.Format.SpaceBefore = Unit.FromPoint(8);
        rule.Format.SpaceAfter = Unit.FromPoint(14);

        var indexHeading = section.AddParagraph("Index");
        indexHeading.Format.Font.Size = 12;
        indexHeading.Format.Font.Bold = true;
        indexHeading.Format.SpaceAfter = Unit.FromPoint(5);

        var table = section.AddTable();
        table.Borders.Width = 0;

        var customerCol = table.AddColumn(Unit.FromCentimeter(10.4));
        customerCol.LeftPadding = Unit.FromPoint(6);
        customerCol.RightPadding = Unit.FromPoint(6);
        var mobileCol = table.AddColumn(Unit.FromCentimeter(4));
        mobileCol.LeftPadding = Unit.FromPoint(6);
        mobileCol.RightPadding = Unit.FromPoint(6);
        var pageCol = table.AddColumn(Unit.FromCentimeter(3));
        pageCol.LeftPadding = Unit.FromPoint(6);
        pageCol.RightPadding = Unit.FromPoint(6);

        var header = table.AddRow();
        header.HeadingFormat = true; // Repeats on every index page — a long index needs its headings back.
        header.Shading.Color = HeaderFill;
        header.Format.Font.Bold = true;
        header.Format.Font.Size = 8.5;
        header.Format.Font.Color = Muted;
        header.TopPadding = Unit.FromPoint(4);
        header.BottomPadding = Unit.FromPoint(4);
        header.Borders.Bottom.Width = 0.75;
        header.Borders.Bottom.Color = Line;
        header.Cells[0].AddParagraph("CUSTOMER");
        header.Cells[1].AddParagraph("MOBILE");
        var pageHead = header.Cells[2].AddParagraph("PAGE");
        pageHead.Format.Alignment = ParagraphAlignment.Right;

        for (var i = 0; i < customers.Count; i++)
        {
            var row = table.AddRow();
            row.TopPadding = Unit.FromPoint(4);
            row.BottomPadding = Unit.FromPoint(4);
            row.Borders.Bottom.Width = 0.5;
            row.Borders.Bottom.Color = Line;

            row.Cells[0].AddParagraph(customers[i].FullName);
            row.Cells[1].AddParagraph(FormatPhone(customers[i].PhoneNumber));

            // The page the customer's section actually lands on — a reference to the bookmark laid
            // at their heading, resolved at render time. This is what makes the index a thing you
            // can turn to rather than decoration.
            var pageCell = row.Cells[2].AddParagraph();
            pageCell.Format.Alignment = ParagraphAlignment.Right;
            pageCell.AddPageRefField(Bookmark(i));
        }
    }

    private static void AddCustomer(Section section, CustomerMeasurementsDto customer, int index, bool isFirst)
    {
        // A card-style header: a pale accent-tinted band with an accent spine down its left edge, so
        // each customer's identity is the first thing the eye lands on down the page. Dark text, not
        // reversed out — restrained, and it stays legible in grayscale.
        var card = section.AddTable();
        card.Borders.Width = 0;
        var cardCol = card.AddColumn(UsableWidth);
        cardCol.LeftPadding = Unit.FromPoint(8);
        cardCol.RightPadding = Unit.FromPoint(8);

        var cardRow = card.AddRow();
        cardRow.Shading.Color = SectionFill;
        cardRow.TopPadding = Unit.FromPoint(5);
        cardRow.BottomPadding = Unit.FromPoint(5);
        cardRow.Cells[0].Borders.Left.Width = 2.5;
        cardRow.Cells[0].Borders.Left.Color = Accent;
        if (!isFirst)
        {
            cardRow.Cells[0].Format.SpaceBefore = Unit.FromPoint(16);
        }

        var namePara = cardRow.Cells[0].AddParagraph();
        namePara.AddBookmark(Bookmark(index)); // Target of the index's page reference.
        var nameText = namePara.AddFormattedText(customer.FullName.ToUpperInvariant(), TextFormat.Bold);
        nameText.Font.Size = 12.5;
        nameText.Font.Color = Ink;

        var mobilePara = cardRow.Cells[0].AddParagraph(FormatPhone(customer.PhoneNumber));
        mobilePara.Format.Font.Size = 9;
        mobilePara.Format.Font.Color = Muted;
        mobilePara.Format.SpaceBefore = Unit.FromPoint(1);

        if (customer.Garments.Count == 0)
        {
            AddEmptyState(section);
            return;
        }

        foreach (var garment in customer.Garments)
        {
            var garmentHeading = section.AddParagraph();
            var garmentText = garmentHeading.AddFormattedText(garment.GarmentType.ToUpperInvariant(), TextFormat.Bold);
            garmentText.Font.Color = Accent;
            garmentText.Font.Size = 9.5;
            garmentHeading.Format.SpaceBefore = Unit.FromPoint(9);
            garmentHeading.Format.SpaceAfter = Unit.FromPoint(3);
            garmentHeading.Format.KeepWithNext = true; // Heading stays with its table.

            AddMeasurementTable(section, garment.Entries);

            if (!string.IsNullOrWhiteSpace(garment.Notes))
            {
                var note = section.AddParagraph($"Note: {garment.Notes}");
                note.Format.Font.Italic = true;
                note.Format.Font.Color = Muted;
                note.Format.Font.Size = 8;
                note.Format.SpaceBefore = Unit.FromPoint(2);
            }
        }
    }

    /// <summary>
    /// One garment's points as a plain two-column table: the measurement on the left, its value on
    /// the right. Long names wrap inside the left column rather than pushing the value off the page.
    /// </summary>
    private static void AddMeasurementTable(Section section, IReadOnlyList<MeasurementEntryDto> entries)
    {
        var table = section.AddTable();
        table.Borders.Width = 0;

        var labelCol = table.AddColumn(Unit.FromCentimeter(13));
        labelCol.LeftPadding = Unit.FromPoint(6);
        labelCol.RightPadding = Unit.FromPoint(6);
        var valueCol = table.AddColumn(Unit.FromCentimeter(4.4));
        valueCol.LeftPadding = Unit.FromPoint(6);
        valueCol.RightPadding = Unit.FromPoint(6);

        var head = table.AddRow();
        head.HeadingFormat = true; // So a garment spilling onto a second page keeps its column heads.
        head.Shading.Color = HeaderFill;
        head.TopPadding = Unit.FromPoint(3);
        head.BottomPadding = Unit.FromPoint(3);
        head.Borders.Bottom.Width = 0.75;
        head.Borders.Bottom.Color = Line;
        head.Format.Font.Size = 7.5;
        head.Format.Font.Bold = true;
        head.Format.Font.Color = Muted;
        head.Cells[0].AddParagraph("MEASUREMENT");
        var valueHead = head.Cells[1].AddParagraph("VALUE");
        valueHead.Format.Alignment = ParagraphAlignment.Right;

        if (entries.Count == 0)
        {
            var blankRow = table.AddRow();
            blankRow.TopPadding = Unit.FromPoint(3);
            blankRow.BottomPadding = Unit.FromPoint(3);
            var blank = blankRow.Cells[0].AddParagraph("No points recorded.");
            blank.Format.Font.Color = Muted;
            blank.Format.Font.Size = 8.5;
            blankRow.Cells[0].MergeRight = 1;
            return;
        }

        for (var i = 0; i < entries.Count; i++)
        {
            var row = table.AddRow();
            row.TopPadding = Unit.FromPoint(3);
            row.BottomPadding = Unit.FromPoint(3);
            row.Borders.Bottom.Width = 0.5;
            row.Borders.Bottom.Color = Line;

            var label = row.Cells[0].AddParagraph(entries[i].Label);
            label.Format.Font.Size = 9;

            var value = row.Cells[1].AddParagraph();
            value.Format.Alignment = ParagraphAlignment.Right;
            var valueText = value.AddFormattedText(entries[i].Value, TextFormat.Bold);
            valueText.Font.Size = 9;
        }
    }

    /// <summary>
    /// The clean "nothing here yet" state for a customer with no measurements — a quiet bordered
    /// panel rather than a blank gap under the header.
    /// </summary>
    private static void AddEmptyState(Section section)
    {
        var table = section.AddTable();
        table.Borders.Width = 0;
        var col = table.AddColumn(UsableWidth);
        col.LeftPadding = Unit.FromPoint(8);
        col.RightPadding = Unit.FromPoint(8);

        var row = table.AddRow();
        row.TopPadding = Unit.FromPoint(7);
        row.BottomPadding = Unit.FromPoint(7);
        row.Cells[0].Borders.Width = 0.5;
        row.Cells[0].Borders.Color = Line;

        var title = row.Cells[0].AddParagraph("No measurements available");
        title.Format.Font.Bold = true;
        title.Format.Font.Size = 9;
        title.Format.Font.Color = Ink;

        var body = row.Cells[0].AddParagraph("Measurements have not been recorded for this customer.");
        body.Format.Font.Size = 8.5;
        body.Format.Font.Color = Muted;
        body.Format.SpaceBefore = Unit.FromPoint(1);
    }

    /// <summary>
    /// Presentation only — groups the digits for reading and never drops or changes one. A 12-digit
    /// number carrying the 91 country code, or a bare 10-digit one, reads as "+91 99409 42083";
    /// anything else is left exactly as stored.
    /// </summary>
    private static string FormatPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        var local = digits.Length == 12 && digits.StartsWith("91", StringComparison.Ordinal)
            ? digits[2..]
            : digits;

        return local.Length == 10 ? $"+91 {local[..5]} {local[5..]}" : phone;
    }

    private static string Bookmark(int index) => $"customer-{index}";

    private static string? LogoBase64()
    {
        var assembly = typeof(MeasurementBackupPdf).Assembly;
        using var stream = assembly.GetManifestResourceStream("MathilensERP.Api.Assets.logo.png");
        if (stream is null)
        {
            // The wordmark carries the header on its own, so a missing asset must not fail the whole
            // backup — the header simply goes without the mark above it.
            return null;
        }

        using var memory = new MemoryStream();
        stream.CopyTo(memory);
        return Convert.ToBase64String(memory.ToArray());
    }

    private static byte[] Render(Document document)
    {
        var renderer = new PdfDocumentRenderer { Document = document };
        renderer.RenderDocument();

        using var stream = new MemoryStream();
        renderer.PdfDocument.Save(stream);
        return stream.ToArray();
    }
}
