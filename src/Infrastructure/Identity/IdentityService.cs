using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Domain.Identity;
using MathilensERP.Infrastructure.Persistence;
using MathilensERP.Shared.Authorization;
using MathilensERP.Shared.Results;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace MathilensERP.Infrastructure.Identity;

/// <summary>
/// Implements the <see cref="IIdentityService"/> port defined in Application, using ASP.NET
/// Core Identity's <see cref="UserManager{TUser}"/>/<see cref="SignInManager{TUser}"/> for
/// credential verification and lockout, and hand-issuing JWT access tokens + opaque refresh
/// tokens (01_ARCHITECTURE.md § 17 Authentication Flow).
/// </summary>
public sealed class IdentityService : IIdentityService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly ApplicationDbContext _dbContext;
    private readonly JwtOptions _jwtOptions;
    private readonly IPasswordHasher<ApplicationUser> _passwordHasher;
    private readonly IActiveSessionService _activeSessions;

    public IdentityService(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        ApplicationDbContext dbContext,
        IOptions<JwtOptions> jwtOptions,
        IPasswordHasher<ApplicationUser> passwordHasher,
        IActiveSessionService activeSessions)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _dbContext = dbContext;
        _jwtOptions = jwtOptions.Value;
        _passwordHasher = passwordHasher;
        _activeSessions = activeSessions;
    }

    public async Task<Result<AuthTokensDto>> LoginAsync(string userName, string password, CancellationToken cancellationToken)
    {
        // By username, which is what the sign-in screen now asks for. Identity looks this up on the
        // normalized column behind a unique index, so it is case-insensitive in the way a person
        // typing their own name at a counter expects.
        var user = await _userManager.FindByNameAsync(userName);
        if (user is null || user.IsDeleted)
        {
            return Result.Failure<AuthTokensDto>(InvalidCredentialsError());
        }

        var signInResult = await _signInManager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);
        if (!signInResult.Succeeded)
        {
            return Result.Failure<AuthTokensDto>(signInResult.IsLockedOut
                ? Error.Unauthorized("Auth.LockedOut", "This account is temporarily locked due to repeated failed sign-in attempts.")
                : InvalidCredentialsError());
        }

        var tokens = await IssueTokensAsync(user, cancellationToken);
        return Result.Success(tokens);
    }

    public async Task<Result<AuthTokensDto>> RegisterAsync(string email, string password, CancellationToken cancellationToken)
    {
        var existingUser = await _userManager.FindByEmailAsync(email);
        if (existingUser is not null)
        {
            return Result.Failure<AuthTokensDto>(
                Error.Conflict("Auth.EmailAlreadyRegistered", "An account with this email already exists."));
        }

        // The bootstrap account signs in with its email address as its username. Registration is the
        // fresh-database path — there is nobody yet to hand out a username, and asking whoever is
        // setting the shop up to invent a second identifier before they have an account is a step
        // with nothing behind it. Every account created afterwards, on the Users screen, picks one.
        var user = new ApplicationUser { UserName = email, Email = email };
        var createResult = await _userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
        {
            var details = createResult.Errors
                .Select(e => new FieldError("password", e.Description))
                .ToList();
            return Result.Failure<AuthTokensDto>(
                Error.Validation("Auth.RegistrationFailed", "This account could not be created.", details));
        }

        // The very first account to register is the shop owner — otherwise nobody would hold the
        // permission to grant anyone else access, and the system would be locked out of itself.
        // Everyone after that starts with the least privilege and is raised deliberately.
        var isFirstUser = await _userManager.Users.CountAsync(cancellationToken) == 1;
        await _userManager.AddToRoleAsync(user, isFirstUser ? AppRoles.Owner : AppRoles.Tailor);

        var tokens = await IssueTokensAsync(user, cancellationToken);
        return Result.Success(tokens);
    }

    public async Task<Result<AuthTokensDto>> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var tokenHash = Hash(refreshToken);
        var existingToken = await _dbContext.RefreshTokens
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

        if (existingToken is null)
        {
            return Result.Failure<AuthTokensDto>(InvalidRefreshTokenError());
        }

        var now = DateTime.UtcNow;

        if (existingToken.IsRevoked)
        {
            // Replay of an already-rotated/revoked token: treat as a compromise signal and
            // revoke every active token for this user (00_MASTER_SPEC.md § 10.1).
            await RevokeAllActiveTokensAsync(existingToken.UserId, now, cancellationToken);

            return Result.Failure<AuthTokensDto>(
                Error.Unauthorized("Auth.TokenReuseDetected", "This refresh token has already been used. All sessions have been revoked."));
        }

        if (existingToken.IsExpired(now))
        {
            return Result.Failure<AuthTokensDto>(
                Error.Unauthorized("Auth.RefreshTokenExpired", "The refresh token has expired."));
        }

        var user = await _userManager.FindByIdAsync(existingToken.UserId.ToString());
        if (user is null || user.IsDeleted)
        {
            return Result.Failure<AuthTokensDto>(InvalidRefreshTokenError());
        }

        var tokens = await IssueTokensAsync(user, cancellationToken, rotatedFrom: existingToken);
        return Result.Success(tokens);
    }

    private async Task RevokeAllActiveTokensAsync(Guid userId, DateTime nowUtc, CancellationToken cancellationToken)
    {
        var activeTokens = await _dbContext.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);

        foreach (var token in activeTokens)
        {
            token.Revoke(nowUtc);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<Result<AuthTokensDto>> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Result.Failure<AuthTokensDto>(Error.NotFound("Users.NotFound", "This account no longer exists."));
        }

        var changed = await _userManager.ChangePasswordAsync(user, currentPassword, newPassword);
        if (!changed.Succeeded)
        {
            // Identity reports a wrong current password and a policy failure the same way. Both are
            // shown to a caller who has already proved who they are, so there is nothing to protect
            // here — the field is named so the form can put the message where it belongs.
            var details = changed.Errors
                .Select(e => new FieldError(
                    e.Code.Contains("Password", StringComparison.Ordinal) && e.Code.Contains("Mismatch", StringComparison.Ordinal)
                        ? "currentPassword"
                        : "newPassword",
                    e.Description))
                .ToList();
            return Result.Failure<AuthTokensDto>(Error.Validation("Users.ChangePasswordFailed", "This password could not be changed.", details));
        }

        // The account is no longer on a password somebody else knows, so the requirement to change
        // it is satisfied and lifted. Cleared before the tokens are issued below, or the fresh pair
        // would still carry the flag and send the user straight back to the same screen.
        await _userManager.RemoveAuthenticationTokenAsync(
            user, PasswordResetCodes.Provider, TemporaryPasswords.MustChangeTokenName);

        // Everything else signed in with the old password stops here. The caller is handed a fresh
        // pair so the screen they are standing at keeps working — without that, changing your own
        // password would sign you out of it within the access token's lifetime.
        await _userManager.UpdateSecurityStampAsync(user);
        await RevokeRefreshTokensAsync(user.Id, cancellationToken);

        return Result.Success(await IssueTokensAsync(user, cancellationToken));
    }

    public async Task<Result> RedeemResetCodeAsync(string email, string code, string newPassword, CancellationToken cancellationToken)
    {
        // One failure for every way this can go wrong: unknown email, no code outstanding, expired,
        // or simply wrong. Distinguishing them would turn this unauthenticated endpoint into a way
        // to discover which addresses have accounts, and which of those are mid-reset.
        var invalid = Result.Failure(Error.Validation(
            "Auth.ResetCodeInvalid",
            "That code is not valid. Ask the shop owner for a new one.",
            [new FieldError("code", "This code is not valid, or it has expired.")]));

        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
        {
            return invalid;
        }

        var storedHash = await _userManager.GetAuthenticationTokenAsync(user, PasswordResetCodes.Provider, PasswordResetCodes.CodeHashName);
        var expiresRaw = await _userManager.GetAuthenticationTokenAsync(user, PasswordResetCodes.Provider, PasswordResetCodes.ExpiresName);

        if (string.IsNullOrEmpty(storedHash)
            || !DateTime.TryParse(expiresRaw, null, System.Globalization.DateTimeStyles.RoundtripKind, out var expiresAtUtc)
            || expiresAtUtc <= DateTime.UtcNow
            || !PasswordResetCodes.Verify(_passwordHasher, user, storedHash, code))
        {
            return invalid;
        }

        var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
        var reset = await _userManager.ResetPasswordAsync(user, resetToken, newPassword);
        if (!reset.Succeeded)
        {
            // The password policy is the one thing worth reporting precisely: the caller holds a
            // valid code, so this tells them nothing they did not already know about the account.
            var details = reset.Errors.Select(e => new FieldError("newPassword", e.Description)).ToList();
            return Result.Failure(Error.Validation("Auth.ResetPasswordFailed", "This password could not be set.", details));
        }

        // Single use. Clearing both parts means a code cannot be replayed even inside its lifetime.
        await _userManager.RemoveAuthenticationTokenAsync(user, PasswordResetCodes.Provider, PasswordResetCodes.CodeHashName);
        await _userManager.RemoveAuthenticationTokenAsync(user, PasswordResetCodes.Provider, PasswordResetCodes.ExpiresName);

        // Redeeming a code means the user chose this password themselves, so there is nothing left
        // to force. Cleared in case the account also had a temporary password outstanding.
        await _userManager.RemoveAuthenticationTokenAsync(user, PasswordResetCodes.Provider, TemporaryPasswords.MustChangeTokenName);

        await _userManager.UpdateSecurityStampAsync(user);
        await RevokeRefreshTokensAsync(user.Id, cancellationToken);
        await _userManager.ResetAccessFailedCountAsync(user);
        await _userManager.SetLockoutEndDateAsync(user, null);

        return Result.Success();
    }

    /// <summary>Ends every session the user currently holds.</summary>
    private async Task RevokeRefreshTokensAsync(Guid userId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var activeTokens = await _dbContext.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);

        foreach (var activeToken in activeTokens)
        {
            activeToken.Revoke(now);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<AuthTokensDto> IssueTokensAsync(ApplicationUser user, CancellationToken cancellationToken, RefreshToken? rotatedFrom = null)
    {
        var now = DateTime.UtcNow;
        var roles = await _userManager.GetRolesAsync(user);

        // A refresh keeps the session it was issued under; only a fresh sign-in starts a new one.
        // Rotating on refresh would have every screen quietly evict itself every quarter of an hour.
        var sessionId = rotatedFrom is null
            ? Guid.NewGuid().ToString("N")
            : await CurrentSessionIdOfAsync(user) ?? Guid.NewGuid().ToString("N");

        var accessToken = GenerateAccessToken(user, roles, now, sessionId, out var accessTokenExpiresAtUtc);

        var rawRefreshToken = GenerateRefreshTokenValue();
        var refreshTokenEntity = RefreshToken.Issue(
            user.Id,
            Hash(rawRefreshToken),
            now,
            now.AddDays(_jwtOptions.RefreshTokenExpiryDays));

        _dbContext.RefreshTokens.Add(refreshTokenEntity);
        rotatedFrom?.Revoke(now, refreshTokenEntity.Id);

        await _dbContext.SaveChangesAsync(cancellationToken);

        // After the tokens exist, so a failure here cannot leave a session recorded for a sign-in
        // that never completed.
        await _activeSessions.StartSessionAsync(user.Id, sessionId, cancellationToken);

        // Read on every issue, not only on sign-in: a refresh must keep saying so, or a user who
        // waited fifteen minutes on the change-password screen would be let past by a token renewal.
        var mustChangePassword = await _userManager.GetAuthenticationTokenAsync(
            user, PasswordResetCodes.Provider, TemporaryPasswords.MustChangeTokenName) is not null;

        return new AuthTokensDto(accessToken, rawRefreshToken, accessTokenExpiresAtUtc, mustChangePassword);
    }

    private string GenerateAccessToken(ApplicationUser user, IList<string> roles, DateTime nowUtc, string sessionId, out DateTime expiresAtUtc)
    {
        expiresAtUtc = nowUtc.AddMinutes(_jwtOptions.AccessTokenExpiryMinutes);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            // Which sign-in this token belongs to. Checked on every request against the account's
            // current session, so signing in elsewhere invalidates this token at once rather than
            // when it expires.
            new(IActiveSessionService.SessionClaimType, sessionId),
        };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var signingKey = new SymmetricSecurityKey(Convert.FromBase64String(_jwtOptions.SigningKey));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            notBefore: nowUtc,
            expires: expiresAtUtc,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>The session a refresh should continue, read straight from the store.</summary>
    private Task<string?> CurrentSessionIdOfAsync(ApplicationUser user) =>
        _userManager.GetAuthenticationTokenAsync(user, PasswordResetCodes.Provider, ActiveSessionService.TokenName);

    private static string GenerateRefreshTokenValue() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    /// <summary>Only the hash is ever persisted or looked up (02_DATABASE.md § 10.14).</summary>
    private static string Hash(string value) => Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static Error InvalidCredentialsError() => Error.Unauthorized("Auth.InvalidCredentials", "Invalid username or password.");

    private static Error InvalidRefreshTokenError() => Error.Unauthorized("Auth.InvalidRefreshToken", "The refresh token is invalid.");
}
