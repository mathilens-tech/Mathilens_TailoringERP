using MathilensERP.Application.Common.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Memory;

namespace MathilensERP.Infrastructure.Identity;

/// <summary>
/// Implements <see cref="IActiveSessionService"/> over Identity's user-token store, fronted by an
/// in-memory cache.
///
/// The store is the same <c>UserTokens</c> table the reset codes use, so this needs no migration
/// and inherits the cascade delete that comes with the user.
///
/// <para>
/// The cache is what makes a per-request check affordable, and it is written through on every
/// change rather than merely expiring — so signing in elsewhere takes effect on the very next
/// request, which is the point. The expiry is only a backstop for a process that restarted.
/// </para>
///
/// <para>
/// One caveat worth stating: the cache is per process. Scaled to more than one instance, an
/// instance that did not handle the new sign-in keeps honouring the old session until its entry
/// expires. This app is deployed as a single Azure App Service instance; if that changes, this
/// wants a shared cache rather than a longer expiry.
/// </para>
/// </summary>
public sealed class ActiveSessionService : IActiveSessionService
{
    /// <summary>Internal so token issuance can read the same name rather than repeating the literal.</summary>
    internal const string TokenName = "ActiveSessionId";

    /// <summary>Short, because it is only covering a restart — the write-through keeps it honest.</summary>
    private static readonly TimeSpan CacheLifetime = TimeSpan.FromMinutes(10);

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IMemoryCache _cache;

    public ActiveSessionService(UserManager<ApplicationUser> userManager, IMemoryCache cache)
    {
        _userManager = userManager;
        _cache = cache;
    }

    public async Task StartSessionAsync(Guid userId, string sessionId, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return;
        }

        await _userManager.SetAuthenticationTokenAsync(user, PasswordResetCodes.Provider, TokenName, sessionId);
        _cache.Set(CacheKey(userId), sessionId, CacheLifetime);
    }

    public async Task<bool> IsCurrentAsync(Guid userId, string? sessionId, CancellationToken cancellationToken)
    {
        // Tokens minted before single-session existed carry no session id. Treating those as invalid
        // would sign out every user the moment this shipped, for no security gain — the next sign-in
        // stamps one on.
        if (string.IsNullOrEmpty(sessionId))
        {
            return true;
        }

        var current = await GetCurrentAsync(userId, cancellationToken);

        // Nothing recorded means nothing to contradict: an account that has not signed in since this
        // shipped should not have its existing token rejected.
        return current is null || string.Equals(current, sessionId, StringComparison.Ordinal);
    }

    public async Task ClearSessionAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is not null)
        {
            await _userManager.RemoveAuthenticationTokenAsync(user, PasswordResetCodes.Provider, TokenName);
        }

        _cache.Remove(CacheKey(userId));
    }

    private async Task<string?> GetCurrentAsync(Guid userId, CancellationToken cancellationToken)
    {
        if (_cache.TryGetValue(CacheKey(userId), out string? cached))
        {
            return cached;
        }

        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return null;
        }

        var stored = await _userManager.GetAuthenticationTokenAsync(user, PasswordResetCodes.Provider, TokenName);
        _cache.Set(CacheKey(userId), stored, CacheLifetime);
        return stored;
    }

    private static string CacheKey(Guid userId) => $"Session.Active.{userId}";
}
