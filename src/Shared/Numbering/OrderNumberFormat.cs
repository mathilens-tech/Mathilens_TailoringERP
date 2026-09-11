using System.Text;

namespace MathilensERP.Shared.Numbering;

/// <summary>
/// Turns a running count into the reference a shop reads out — <c>RFA-0001</c>.
///
/// <para>Three parts. The <b>code</b> is the shop's own, set on Settings → Order Number. The
/// <b>letter</b> advances once the four digits beside it are used up, so the number stays four
/// digits wide instead of growing a fifth. The <b>count</b> runs 1111 to 9999 within each letter.</para>
///
/// <para>Pure and separate from the generator so the rule can be tested without a database, and so
/// the settings screen's preview and the number actually issued cannot drift apart.</para>
/// </summary>
public static class OrderNumberFormat
{
    /// <summary>
    /// Where each letter's run begins.
    ///
    /// <para>1111 rather than 0001, because the first reference a shop hands out is read by the
    /// customer holding it. "RFA-0001" says this is the first order the shop has ever taken, which
    /// is not the impression a tailor wants to give someone deciding whether to leave cloth with
    /// them. Every run starts here, not only the first — otherwise the day the letter turns over,
    /// "RFB-0001" says it all over again.</para>
    /// </summary>
    public const int FirstCount = 1111;

    /// <summary>The last count in a run, after which the letter moves on.</summary>
    public const int LastCount = 9999;

    /// <summary>How many references one letter covers: 1111 through 9999 inclusive.</summary>
    public const int NumbersPerLetter = LastCount - FirstCount + 1;

    /// <summary>Four digits, so every reference in a letter's run is the same width and sorts as one block.</summary>
    private const string CountFormat = "0000";

    /// <summary>
    /// The reference for the <paramref name="sequenceValue"/>th order ever taken.
    /// </summary>
    /// <param name="prefix">The shop's code, already trimmed and cased by the caller.</param>
    /// <param name="sequenceValue">1 for the first order. Values come from a database sequence, so they never repeat.</param>
    public static string Format(string prefix, long sequenceValue)
    {
        if (sequenceValue < 1)
        {
            throw new ArgumentOutOfRangeException(
                nameof(sequenceValue), sequenceValue, "Order numbering starts at 1.");
        }

        // Zero-based, so the first order lands in block 0 (letter A) at position 0 (count 1111).
        var zeroBased = sequenceValue - 1;
        var block = zeroBased / NumbersPerLetter;
        var count = FirstCount + zeroBased % NumbersPerLetter;

        return $"{prefix}{LetterFor(block)}-{count.ToString(CountFormat)}";
    }

    /// <summary>
    /// The letter for a block: A, B … Z, then AA, AB … — spreadsheet column naming.
    ///
    /// <para>The requirement stops at Z, which is 231,114 orders away and past what this shop will
    /// ever take. Something still has to be returned beyond it, and widening to AA is the one
    /// answer that cannot hand out a reference twice — wrapping back to A would, and a duplicate
    /// reference is a dispute at the counter. It is the same trade the count itself already makes.</para>
    /// </summary>
    public static string LetterFor(long block)
    {
        if (block < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(block), block, "Blocks are counted from zero.");
        }

        // Bijective base-26: there is no "zero" digit, so A is 1 rather than 0 and the decrement
        // inside the loop is what makes Z roll into AA instead of into BA.
        var value = block + 1;
        var letters = new StringBuilder();

        while (value > 0)
        {
            value--;
            letters.Insert(0, (char)('A' + value % 26));
            value /= 26;
        }

        return letters.ToString();
    }
}
