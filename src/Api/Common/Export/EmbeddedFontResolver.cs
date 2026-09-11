using System.Collections.Concurrent;
using PdfSharp.Fonts;

namespace MathilensERP.Api.Common.Export;

/// <summary>
/// Supplies the font bytes PDFsharp draws with.
///
/// <para>
/// The cross-platform <c>PDFsharp-MigraDoc</c> package reads no system fonts whatsoever: it asks an
/// <see cref="IFontResolver"/> for every face and throws if none is registered. Without one, every
/// PDF export failed with <em>"The font 'Courier New' cannot be resolved for predefined error
/// font"</em> — MigraDoc failing to build its own internal fallback font before it ever reached the
/// document. Nothing in that message points at export code, which is why it is written down here.
/// </para>
///
/// <para>
/// The faces travel inside the assembly rather than being read off the machine. Resolving against
/// the operating system would find Arial on a developer's Windows box and nothing at all in a
/// stripped container image, so the export would work everywhere except where it matters. Embedded
/// bytes render the same file on every host.
/// </para>
/// </summary>
public sealed class EmbeddedFontResolver : IFontResolver
{
    /// <summary>What <see cref="PdfTable"/> asks for, and what the embedded files genuinely are.</summary>
    public const string FamilyName = "Noto Sans";

    private const string RegularFace = "NotoSans-Regular";
    private const string BoldFace = "NotoSans-Bold";

    /// <summary>Matches the <c>LogicalName</c> the .csproj gives the embedded fonts.</summary>
    private const string ResourcePrefix = "MathilensERP.Api.Fonts.";

    // A face is requested once per document at minimum, and the byte arrays are half a megabyte
    // each. Reading them out of the assembly every time would be pure waste.
    private static readonly ConcurrentDictionary<string, byte[]> Faces = new();

    public FontResolverInfo? ResolveTypeface(string familyName, bool isBold, bool isItalic)
    {
        // Every family resolves onto the one we ship, deliberately. MigraDoc asks for faces this
        // code never names — Courier New for its error font among them — and returning null for
        // those is exactly what crashed the export. Substituting is the lesser evil: a report in an
        // unexpected typeface is still a report, a report that 500s is not.
        var face = isBold ? BoldFace : RegularFace;

        // Bold is a real face because the headings and column headers lean on it and a synthesised
        // bold at 8pt smears. No italic is shipped, so PDFsharp slants the upright face itself —
        // nothing in these tables is italic today, and a slanted fallback beats a missing glyph.
        return new FontResolverInfo(face, false, isItalic);
    }

    public byte[]? GetFont(string faceName) => Faces.GetOrAdd(faceName, Load);

    private static byte[] Load(string faceName)
    {
        var resourceName = ResourcePrefix + faceName + ".ttf";
        var assembly = typeof(EmbeddedFontResolver).Assembly;

        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException(
                $"Embedded font '{resourceName}' was not found. It is declared as an EmbeddedResource " +
                "in MathilensERP.Api.csproj; a rename there without one here breaks every PDF export.");

        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return buffer.ToArray();
    }
}
