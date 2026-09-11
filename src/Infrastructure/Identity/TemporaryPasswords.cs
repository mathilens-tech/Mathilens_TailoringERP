using System.Security.Cryptography;

namespace MathilensERP.Infrastructure.Identity;

/// <summary>
/// The password an Owner hands over when they reset someone's account, and the flag that makes the
/// user replace it the moment they sign in with it.
///
/// <para>Generated here rather than typed by the Owner: a password somebody else chooses for you is
/// one they know, and staff passwords picked at a counter under time pressure are the same three
/// every time. This one is random, used once, and replaced by the user before they reach any screen.</para>
///
/// <para>The flag lives in Identity's user-token table, like <see cref="PasswordResetCodes"/> and
/// the active session — no migration, and Identity's store already handles per-user uniqueness and
/// cascade delete.</para>
/// </summary>
internal static class TemporaryPasswords
{
    /// <summary>Set when a password is reset, cleared the moment the user chooses their own.</summary>
    public const string MustChangeTokenName = "MustChangePassword";

    /// <summary>Identity stores token values as text; the value itself carries no information beyond existing.</summary>
    public const string MustChangeTokenValue = "true";

    /// <summary>
    /// Eight characters, matching the policy's minimum in DependencyInjection — long enough to be
    /// accepted, short enough to read down a counter or over a phone.
    /// </summary>
    private const int Length = 8;

    /*
      Three alphabets rather than one, because the policy requires an uppercase letter, a lowercase
      letter and a digit — drawing eight characters from a single pool would occasionally produce a
      password the API then refuses, which is a failure the Owner cannot do anything about.

      Crockford-style throughout: no I, l, 1, O or 0, so nothing can be misheard when it is spoken
      aloud or mistaken for something else when it is written on a slip of paper. That matters more
      here than raw entropy — this password is transcribed by hand, once, and then thrown away.
    */
    private const string Upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
    private const string Lower = "abcdefghijkmnpqrstuvwxyz";
    private const string Digits = "23456789";
    private const string All = Upper + Lower + Digits;

    /// <summary>A random password that is guaranteed to satisfy the configured password policy.</summary>
    public static string Generate()
    {
        var characters = new char[Length];

        // One of each required kind first, so the policy is satisfied by construction rather than
        // by luck and a retry loop.
        characters[0] = Upper[RandomNumberGenerator.GetInt32(Upper.Length)];
        characters[1] = Lower[RandomNumberGenerator.GetInt32(Lower.Length)];
        characters[2] = Digits[RandomNumberGenerator.GetInt32(Digits.Length)];

        for (var i = 3; i < Length; i++)
        {
            characters[i] = All[RandomNumberGenerator.GetInt32(All.Length)];
        }

        // Shuffled, or the shape would always be upper-lower-digit and the first three characters
        // would carry far less than their share of the randomness.
        RandomNumberGenerator.Shuffle(characters.AsSpan());

        return new string(characters);
    }
}
