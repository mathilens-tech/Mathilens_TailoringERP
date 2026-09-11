namespace MathilensERP.Shared.Constants;

/// <summary>
/// What a username has to be, in the one place both the sign-in validator and account creation can
/// read it. A minimum enforced at only one of the two ends either as a login nobody can use or as a
/// rule the sign-in screen quietly disagrees with.
///
/// Only the length lives here. Which characters are allowed, and that no two accounts may share a
/// name, are ASP.NET Core Identity's own rules and are enforced by <c>UserManager.CreateAsync</c> —
/// there is no Identity option for a minimum length, which is why this one is the shop's to state.
/// </summary>
public static class UserNameRules
{
    /// <summary>Short enough to type at a counter, long enough not to collide by accident.</summary>
    public const int MinimumLength = 5;

    /// <summary>
    /// Worded once so the field-level message a form shows and the message the API returns are the
    /// same sentence — two spellings of one rule reads as two different rules.
    /// </summary>
    public static readonly string LengthMessage = $"Username must be at least {MinimumLength} characters.";
}
