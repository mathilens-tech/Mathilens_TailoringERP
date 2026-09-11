using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Common.Interfaces;

/// <summary>
/// Port for authentication (00_MASTER_SPEC.md § 10.1 / 01_ARCHITECTURE.md § 17 Authentication
/// Flow). Application depends only on this abstraction and the DTOs it defines — never on
/// ASP.NET Core Identity's <c>UserManager</c>/<c>ApplicationUser</c> directly, since those are
/// Infrastructure-layer types (01_ARCHITECTURE.md § 9.2). Implemented in Infrastructure.
/// </summary>
public interface IIdentityService
{
    /// <summary>
    /// Authenticates by username, not by email address. Accounts predating usernames hold their
    /// email in that field, so they keep signing in with the address they always used.
    /// </summary>
    Task<Result<AuthTokensDto>> LoginAsync(string userName, string password, CancellationToken cancellationToken);

    /// <summary>
    /// Creates a new user account and, on success, signs them straight in — matching the
    /// pattern of a self-service sign-up page (00_MASTER_SPEC.md § 10.1).
    /// </summary>
    Task<Result<AuthTokensDto>> RegisterAsync(string email, string password, CancellationToken cancellationToken);

    /// <summary>
    /// Redeems a refresh token for a new token pair. The presented token is rotated
    /// (revoked and replaced); if it was already revoked, this is treated as a replay and
    /// every active refresh token for that user is revoked (00_MASTER_SPEC.md § 10.1).
    /// </summary>
    Task<Result<AuthTokensDto>> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken);

    /// <summary>
    /// Changes the caller's own password, proving they know the current one.
    ///
    /// Returns a fresh token pair rather than nothing: every other session is revoked, and without
    /// re-issuing here the person who just changed their password would be signed out of the screen
    /// they did it on within the access token's lifetime.
    /// </summary>
    Task<Result<AuthTokensDto>> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken cancellationToken);

    /// <summary>
    /// Redeems a one-time reset code and sets the password the user chose.
    ///
    /// Unauthenticated by necessity — the whole point is that they cannot sign in. The code is what
    /// stands in for authentication, which is why it is single-use, time-limited, and never revealed
    /// by any other endpoint. Failures are deliberately indistinguishable from one another: a
    /// caller must not learn from the response whether an email exists.
    /// </summary>
    Task<Result> RedeemResetCodeAsync(string email, string code, string newPassword, CancellationToken cancellationToken);
}
