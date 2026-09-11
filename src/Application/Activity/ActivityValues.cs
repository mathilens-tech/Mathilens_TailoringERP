using System.Collections;
using System.Text.RegularExpressions;

namespace MathilensERP.Application.Activity;

/// <summary>
/// How a property name and a value are worded in the activity trail.
///
/// Shared between the description of what a command carried and the before-and-after of what it
/// changed, because the two sit next to each other on the screen — a field called "Phone Number"
/// in one and "PhoneNumber" in the other reads as two different fields.
/// </summary>
public static partial class ActivityValues
{
    /// <summary>
    /// Property names that must never reach the trail. Matched as substrings, case-insensitively,
    /// so <c>Password</c>, <c>NewPassword</c> and <c>RefreshToken</c> are all caught — an audit
    /// record is exactly the wrong place to end up holding a credential, and it is written
    /// automatically, so this errs toward redacting too much rather than too little.
    /// </summary>
    private static readonly string[] SecretNameFragments =
        ["password", "token", "secret", "signingkey", "apikey", "credential", "otp", "pin", "hash", "resetcode"];

    /// <summary>What a redacted value is shown as, so the trail still says the field changed.</summary>
    public const string Redacted = "●●●●●";

    public static bool IsSecret(string propertyName) =>
        SecretNameFragments.Any(fragment => propertyName.Contains(fragment, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Returns null for anything not worth a line: unset values, empty collections, and record ids.
    ///
    /// A GUID is the one value in the system that means nothing at all to the person reading the
    /// trail — "Customer Id: 3f2a9c…" is noise where a name belongs, and the row already says which
    /// screen and which action it was. Dropping it here covers both the description and the
    /// before-and-after list, which are built from the same formatter.
    /// </summary>
    public static string? Format(object? value) => value switch
    {
        null => null,
        Guid => null,
        string s => string.IsNullOrWhiteSpace(s) ? null : s.Trim(),
        bool b => b ? "Yes" : "No",
        DateTime d => d.ToString("yyyy-MM-dd HH:mm"),
        DateOnly d => d.ToString("yyyy-MM-dd"),
        decimal m => m.ToString("0.##"),
        // Order items, measurement values and the like: summarised by count rather than dumped,
        // which would push everything else past the length limit.
        IEnumerable enumerable and not string => Count(enumerable) is var count && count == 0 ? null : $"{count} item{(count == 1 ? "" : "s")}",
        _ => value.ToString() is { Length: > 0 } text ? text : null,
    };

    /// <summary><c>PhoneNumber</c> gives "Phone Number", matching how actions are already worded.</summary>
    public static string Humanize(string name) => PascalCaseBoundary().Replace(name, " $1").Trim();

    private static int Count(IEnumerable enumerable)
    {
        if (enumerable is ICollection collection)
        {
            return collection.Count;
        }

        var count = 0;
        foreach (var _ in enumerable)
        {
            count++;
        }

        return count;
    }

    [GeneratedRegex(@"(?<!^)([A-Z][a-z]+|[A-Z]+(?![a-z]))")]
    private static partial Regex PascalCaseBoundary();
}
