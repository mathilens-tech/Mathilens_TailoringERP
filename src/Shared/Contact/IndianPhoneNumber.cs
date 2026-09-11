namespace MathilensERP.Shared.Contact;

/// <summary>
/// The one place a phone number is turned into its canonical form, <c>+91XXXXXXXXXX</c>.
///
/// <para>A number is the natural key for a customer: staff look one up by it at the counter, the
/// spreadsheet import upserts on it, and the WhatsApp module correlates on it. None of that works
/// if the same phone can be stored four ways, so every write path normalizes through here — form,
/// spreadsheet and API alike — rather than each deciding for itself what a number looks like.</para>
///
/// <para>Indian mobile numbers only. A landline or a foreign number does not normalize, and the
/// caller is expected to reject it rather than store something half-converted; there is no shop
/// requirement for either, and guessing a country code onto an unrecognized number is how a
/// number silently becomes the wrong number.</para>
/// </summary>
public static class IndianPhoneNumber
{
    public const string CountryCode = "+91";

    /// <summary>Digits after the country code, and the length the shop knows a mobile number by.</summary>
    public const int NationalDigits = 10;

    /// <summary>
    /// Converts <paramref name="raw"/> to <c>+91XXXXXXXXXX</c>.
    ///
    /// <para>Separators people actually type — spaces, hyphens, brackets — are removed first, so
    /// "+91 82200-70363" and "(0) 8220070363" are the same number. What is left is read by its
    /// digit count: ten is a bare national number, twelve beginning 91 already carries the country
    /// code, eleven beginning 0 carries the old trunk prefix. Anything else is not recognized.</para>
    /// </summary>
    /// <returns><c>true</c> when the number was recognized; <c>false</c> leaves <paramref name="normalized"/> empty.</returns>
    public static bool TryNormalize(string? raw, out string normalized)
    {
        normalized = string.Empty;

        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var digits = new string(raw.Where(char.IsAsciiDigit).ToArray());

        // Anything that isn't a digit or one of the separators above — a letter, a slash, a second
        // number crammed into the field — means this isn't one phone number, and stripping the
        // stray characters would invent one. Checked against the original so the digit rules below
        // only ever see input that was a phone number to begin with.
        if (raw.Any(c => !char.IsAsciiDigit(c) && !IsSeparator(c) && c != '+'))
        {
            return false;
        }

        normalized = digits.Length switch
        {
            NationalDigits => CountryCode + digits,
            12 when digits.StartsWith("91", StringComparison.Ordinal) => "+" + digits,
            11 when digits[0] == '0' => CountryCode + digits[1..],
            _ => string.Empty,
        };

        return normalized.Length > 0;
    }

    /// <summary>
    /// The canonical form when the number is recognized, otherwise the input trimmed and
    /// otherwise untouched.
    ///
    /// <para>For write paths that have already validated, and for the domain's own backstop: an
    /// unrecognized number is preserved exactly as it was given rather than mangled into a shape
    /// it never had. Callers that need to know whether conversion happened use
    /// <see cref="TryNormalize"/>.</para>
    /// </summary>
    public static string Normalize(string? raw) =>
        TryNormalize(raw, out var normalized) ? normalized : raw?.Trim() ?? string.Empty;

    /// <summary>
    /// The ten digits a customer would recite, for anything a person reads.
    ///
    /// <para>Storage is canonical and stays that way — it is what the import, the WhatsApp module
    /// and the uniqueness checks all correlate on. But nobody at the counter says "+91" out loud,
    /// and a message that quotes a number back with it reads as a different number from the one on
    /// screen. This is the seam: canonical below, ten digits wherever it is shown.</para>
    ///
    /// <para>An unrecognized number is returned as it stands rather than trimmed to ten — cutting
    /// one down would show a different, plausible number.</para>
    /// </summary>
    public static string ToDisplay(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        return TryNormalize(raw, out var normalized) ? normalized[CountryCode.Length..] : raw.Trim();
    }

    /// <summary>
    /// Whether <paramref name="raw"/> is a number the shop can actually dial: it normalizes, and
    /// its ten national digits open with 6-9 as every Indian mobile series does.
    /// </summary>
    public static bool IsValid(string? raw) =>
        TryNormalize(raw, out var normalized) && StartsWithMobileSeries(normalized);

    /// <summary>
    /// Whether a normalized number opens with a mobile series digit. Separate from
    /// <see cref="IsValid"/> so a validator can tell "wrong length" from "not a mobile number"
    /// and say which — one message for both leaves the operator guessing at a correct-looking number.
    /// </summary>
    public static bool StartsWithMobileSeries(string normalized) =>
        normalized.Length == CountryCode.Length + NationalDigits
        && normalized[CountryCode.Length] is >= '6' and <= '9';

    private static bool IsSeparator(char c) =>
        char.IsWhiteSpace(c) || c is '-' or '(' or ')';
}
