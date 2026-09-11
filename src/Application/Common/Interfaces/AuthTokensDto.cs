namespace MathilensERP.Application.Common.Interfaces;

/// <summary>Issued token pair returned by a successful login or refresh (00_MASTER_SPEC.md § 10.1).</summary>
/// <param name="MustChangePassword">
/// True when the account is on a temporary password an Owner issued, and the user has to choose
/// their own before doing anything else.
///
/// <para>The sign-in itself still succeeds — knowing the temporary password is what proves who they
/// are, and it is the only proof there is. What the flag says is that the credential is spent: the
/// Owner knows it, it was read out loud, and it should not be what guards the account tomorrow.</para>
/// </param>
public sealed record AuthTokensDto(
    string AccessToken,
    string RefreshToken,
    DateTime AccessTokenExpiresAtUtc,
    bool MustChangePassword = false);
