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

    public int RefreshTokenExpiryDays { get; init; } = 30;
}
