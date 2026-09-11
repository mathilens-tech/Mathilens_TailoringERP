using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;

namespace MathilensERP.Infrastructure.Identity;

/// <summary>
/// The one-time codes an Owner hands over so a user can choose their own password.
///
/// Stored in ASP.NET Core Identity's own user-token table rather than in new columns on the user.
/// That table already exists, so this needs no migration, and Identity's store handles the
/// per-user uniqueness and cascade delete that hand-rolled columns would have to repeat.
///
/// Only a hash is kept. The plaintext is returned to the Owner exactly once at issue and cannot be
/// recovered from the database afterwards — which is the property that makes it safe to store at
/// all, and the reason reopening the screen cannot show it again.
/// </summary>
internal static class PasswordResetCodes
{
    /// <summary>Identity partitions user tokens by provider; this app is its own.</summary>
    public const string Provider = "MathilensERP";

    public const string CodeHashName = "PasswordResetCodeHash";
    public const string ExpiresName = "PasswordResetCodeExpiresUtc";

    /// <summary>
    /// Long enough to resist guessing, short enough to read down a counter.
    ///
    /// Crockford's alphabet: no I, L, O or U, so nothing in a code can be misheard as a digit or
    /// mistaken for another letter when it is spoken aloud or written on a slip of paper.
    /// </summary>
    private const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    private const int CodeLength = 8;

    /// <summary>
    /// A day. Long enough that "come back tomorrow and I'll set it up" still works, short enough
    /// that a code written on a pad and forgotten stops being a way in.
    /// </summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(24);

    /// <summary>Formatted in two halves — a run of eight characters is read back wrong far more often.</summary>
    public static string Generate()
    {
        var characters = new char[CodeLength];
        for (var i = 0; i < CodeLength; i++)
        {
            characters[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }

        var code = new string(characters);
        return $"{code[..4]}-{code[4..]}";
    }

    /// <summary>Normalizes what the user typed: case and the separator are presentation, not secret.</summary>
    public static string Normalize(string code) =>
        new(code.Where(char.IsLetterOrDigit).Select(char.ToUpperInvariant).ToArray());

    /// <summary>
    /// Hashed with Identity's own password hasher rather than a bare SHA-256.
    ///
    /// It is PBKDF2 with a work factor, so guessing an eight-character code offline costs real time
    /// per attempt instead of being bounded only by how fast a machine can hash.
    /// </summary>
    public static string Hash(IPasswordHasher<ApplicationUser> hasher, ApplicationUser user, string code) =>
        hasher.HashPassword(user, Normalize(code));

    public static bool Verify(IPasswordHasher<ApplicationUser> hasher, ApplicationUser user, string storedHash, string suppliedCode) =>
        hasher.VerifyHashedPassword(user, storedHash, Normalize(suppliedCode)) != PasswordVerificationResult.Failed;
}
