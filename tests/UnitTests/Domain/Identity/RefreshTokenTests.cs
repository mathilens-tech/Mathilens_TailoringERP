using MathilensERP.Domain.Identity;

namespace MathilensERP.UnitTests.Domain.Identity;

public class RefreshTokenTests
{
    [Fact]
    public void Issue_WithValidInputs_CreatesActiveToken()
    {
        var userId = Guid.NewGuid();
        var issuedAt = DateTime.UtcNow;
        var expiresAt = issuedAt.AddDays(7);

        var token = RefreshToken.Issue(userId, "hashed-token-value", issuedAt, expiresAt);

        Assert.Equal(userId, token.UserId);
        Assert.Equal("hashed-token-value", token.TokenHash);
        Assert.Equal(userId, token.CreatedBy);
        Assert.Equal(issuedAt, token.CreatedAtUtc);
        Assert.False(token.IsRevoked);
        Assert.True(token.IsActive(issuedAt));
    }

    [Fact]
    public void Issue_WithExpiryBeforeIssuedAt_Throws()
    {
        var userId = Guid.NewGuid();
        var issuedAt = DateTime.UtcNow;

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            RefreshToken.Issue(userId, "hash", issuedAt, issuedAt.AddMinutes(-1)));
    }

    [Fact]
    public void Issue_WithEmptyUserId_Throws()
    {
        var now = DateTime.UtcNow;

        Assert.Throws<ArgumentException>(() =>
            RefreshToken.Issue(Guid.Empty, "hash", now, now.AddDays(1)));
    }

    [Fact]
    public void Issue_WithBlankTokenHash_Throws()
    {
        var now = DateTime.UtcNow;

        Assert.Throws<ArgumentException>(() =>
            RefreshToken.Issue(Guid.NewGuid(), " ", now, now.AddDays(1)));
    }

    [Fact]
    public void IsExpired_AfterExpiryTime_ReturnsTrue()
    {
        var issuedAt = DateTime.UtcNow;
        var token = RefreshToken.Issue(Guid.NewGuid(), "hash", issuedAt, issuedAt.AddMinutes(5));

        Assert.True(token.IsExpired(issuedAt.AddMinutes(10)));
        Assert.False(token.IsActive(issuedAt.AddMinutes(10)));
    }

    [Fact]
    public void Revoke_MarksTokenRevokedAndRecordsReplacement()
    {
        var issuedAt = DateTime.UtcNow;
        var token = RefreshToken.Issue(Guid.NewGuid(), "hash", issuedAt, issuedAt.AddDays(7));
        var replacementId = Guid.NewGuid();

        token.Revoke(issuedAt.AddMinutes(1), replacementId);

        Assert.True(token.IsRevoked);
        Assert.Equal(replacementId, token.ReplacedByTokenId);
        Assert.False(token.IsActive(issuedAt.AddMinutes(1)));
    }

    [Fact]
    public void Revoke_WhenAlreadyRevoked_DoesNotOverwriteRevocationDetails()
    {
        var issuedAt = DateTime.UtcNow;
        var token = RefreshToken.Issue(Guid.NewGuid(), "hash", issuedAt, issuedAt.AddDays(7));
        var firstRevokedAt = issuedAt.AddMinutes(1);
        var firstReplacement = Guid.NewGuid();
        token.Revoke(firstRevokedAt, firstReplacement);

        token.Revoke(issuedAt.AddMinutes(5), Guid.NewGuid());

        Assert.Equal(firstRevokedAt, token.RevokedAtUtc);
        Assert.Equal(firstReplacement, token.ReplacedByTokenId);
    }
}
