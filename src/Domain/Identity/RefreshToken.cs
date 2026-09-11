using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Identity;

/// <summary>
/// A single issued refresh token in a rotation chain (00_MASTER_SPEC.md § 10.1 /
/// 01_ARCHITECTURE.md § 17 Authentication Flow): single-use, rotated on every refresh,
/// with a reused (replayed) token treated as a signal to revoke the caller's active tokens.
///
/// Not <see cref="ISoftDeletable"/>: a refresh token's lifecycle is active → rotated/revoked
/// or expired, not the soft-delete lifecycle of a business record.
/// Only the token's hash is ever persisted — the raw token is never stored.
/// </summary>
public sealed class RefreshToken : IAuditable
{
    public Guid Id { get; private set; }

    public Guid UserId { get; private set; }

    public string TokenHash { get; private set; } = string.Empty;

    public DateTime ExpiresAtUtc { get; private set; }

    public DateTime? RevokedAtUtc { get; private set; }

    public Guid? ReplacedByTokenId { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public Guid CreatedBy { get; private set; }

    public DateTime? LastModifiedAtUtc { get; private set; }

    public Guid? LastModifiedBy { get; private set; }

    public bool IsRevoked => RevokedAtUtc is not null;

    public bool IsExpired(DateTime nowUtc) => nowUtc >= ExpiresAtUtc;

    public bool IsActive(DateTime nowUtc) => !IsRevoked && !IsExpired(nowUtc);

    private RefreshToken()
    {
        // Reserved for EF Core materialization.
    }

    public static RefreshToken Issue(Guid userId, string tokenHash, DateTime issuedAtUtc, DateTime expiresAtUtc)
    {
        Guard.AgainstEmpty(userId, nameof(userId));
        Guard.AgainstNullOrWhiteSpace(tokenHash, nameof(tokenHash));

        if (expiresAtUtc <= issuedAtUtc)
        {
            throw new ArgumentOutOfRangeException(nameof(expiresAtUtc), expiresAtUtc, "A refresh token cannot expire before it is issued.");
        }

        var token = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAtUtc = expiresAtUtc,
        };

        token.SetCreationAudit(userId, issuedAtUtc);

        return token;
    }

    /// <summary>Revokes this token, optionally recording the token that replaced it (rotation).</summary>
    public void Revoke(DateTime revokedAtUtc, Guid? replacedByTokenId = null)
    {
        if (IsRevoked)
        {
            return;
        }

        RevokedAtUtc = revokedAtUtc;
        ReplacedByTokenId = replacedByTokenId;
    }

    public void SetCreationAudit(Guid createdBy, DateTime createdAtUtc)
    {
        CreatedBy = Guard.AgainstEmpty(createdBy, nameof(createdBy));
        CreatedAtUtc = createdAtUtc;
    }

    public void SetModificationAudit(Guid modifiedBy, DateTime modifiedAtUtc)
    {
        LastModifiedBy = Guard.AgainstEmpty(modifiedBy, nameof(modifiedBy));
        LastModifiedAtUtc = modifiedAtUtc;
    }
}
