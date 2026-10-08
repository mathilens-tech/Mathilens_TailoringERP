namespace MathilensERP.Infrastructure.Identity;

/// <summary>
/// Bound from the "Jwt" configuration section. <see cref="SigningKey"/> is a secret
/// (00_MASTER_SPEC.md § 10.10) — supplied via environment variable/secret store in every
/// environment beyond local development, never committed.
/// </summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public required string SigningKey { get; init; }

    public required string Issuer { get; init; }

    public required string Audience { get; init; }

    public int AccessTokenExpiryMinutes { get; init; } = 15;

    /// <summary>
    /// How long a sign-in stays valid without re-entering a password. Ten years by shop request —
    /// staff sign in on a counter device and expect to stay signed in, so the short-lived access
    /// token is renewed against this silently and the session does not expire in practice. The
    /// access token is still only minutes long, so a stolen one is useless almost at once.
    /// </summary>
    public int RefreshTokenExpiryDays { get; init; } = 3650;

    /// <summary>
    /// How many devices one account may be signed in on at once. Two by shop request — a counter
    /// machine and a phone, say. A sign-in beyond this retires the account's oldest session rather
    /// than being refused, so nobody is locked out by a forgotten sign-in elsewhere.
    /// </summary>
    public int MaxConcurrentSessions { get; init; } = 2;
}
