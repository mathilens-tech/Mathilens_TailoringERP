using System.Text.RegularExpressions;

namespace MathilensERP.Shared.Contact;

/// <summary>
/// The shape an email address has to have to be stored, in one place so the form, the API and the
/// spreadsheet import all agree on it.
///
/// <para>Deliberately a shape check and nothing more: something before an @, something after it,
/// and a dot in the domain. It is not a proof the address exists — only a delivery attempt is that
/// — but it catches the typo that actually happens at a counter, a comma pressed instead of a full
/// stop. FluentValidation's <c>EmailAddress()</c> does not: it accepts anything with a single @,
/// which is how "kamalesh@gmail,com" reached the customers table.</para>
/// </summary>
public static partial class EmailAddress
{
    /// <summary>What every layer says when the shape is wrong, so the operator reads one sentence.</summary>
    public const string ValidationMessage = "Enter a valid email address.";

    /// <summary>
    /// Whether <paramref name="value"/> could be an email address. Blank counts as valid — the
    /// field is optional, and "not given" is not the same as "given wrongly"; callers that require
    /// one check for that separately.
    /// </summary>
    public static bool IsValid(string? value) =>
        string.IsNullOrWhiteSpace(value) || Pattern().IsMatch(value.Trim());

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex Pattern();
}
