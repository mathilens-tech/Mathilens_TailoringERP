using MathilensERP.Application.Common.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace MathilensERP.Infrastructure.Identity;

/// <summary>
/// Implements <see cref="IActiveSessionService"/> over Identity's user-token store, fronted by an
/// in-memory cache.
///
/// <para>
/// An account may be signed in on up to <see cref="JwtOptions.MaxConcurrentSessions"/> devices at
/// once. The live session ids are kept as a short, newest-last list in a single user token; a new
/// sign-in appends to it and drops the oldest past the cap, so a third device retires the first
/// rather than being refused. A request is honoured while its session id is anywhere in that list.
/// </para>
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

    /// <summary>The list is stored as session ids joined by this — a GUID "N" string never holds one.</summary>
    private const char Separator = ',';

    /// <summary>Short, because it is only covering a restart — the write-through keeps it honest.</summary>
    private static readonly TimeSpan CacheLifetime = TimeSpan.FromMinutes(10);

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IMemoryCache _cache;
    private readonly int _maxSessions;

    public ActiveSessionService(UserManager<ApplicationUser> userManager, IMemoryCache cache, IOptions<JwtOptions> jwtOptions)
    {
        _userManager = userManager;
        _cache = cache;
        // At least one, so a misconfigured zero does not lock everyone out.
        _maxSessions = Math.Max(1, jwtOptions.Value.MaxConcurrentSessions);
    }

    public async Task StartSessionAsync(Guid userId, string sessionId, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return;
        }

        var stored = await _userManager.GetAuthenticationTokenAsync(user, PasswordResetCodes.Provider, TokenName);
        var sessions = Parse(stored);

        // Move this session to the newest end (deduped), then keep only the newest N. A refresh of
        // an existing device re-affirms its place rather than adding a second entry for it.
        sessions.RemoveAll(id => string.Equals(id, sessionId, StringComparison.Ordinal));
        sessions.Add(sessionId);
        if (sessions.Count > _maxSessions)
        {
            sessions.RemoveRange(0, sessions.Count - _maxSessions);
        }

        var value = string.Join(Separator, sessions);
        await _userManager.SetAuthenticationTokenAsync(user, PasswordResetCodes.Provider, TokenName, value);
        _cache.Set(CacheKey(userId), value, CacheLifetime);
    }

    public async Task<bool> IsCurrentAsync(Guid userId, string? sessionId, CancellationToken cancellationToken)
    {
        // Tokens minted before sessions existed carry no session id. Treating those as invalid would
        // sign out every user the moment this shipped, for no security gain — the next sign-in
        // stamps one on.
        if (string.IsNullOrEmpty(sessionId))
        {
            return true;
        }

        var current = await GetCurrentAsync(userId, cancellationToken);

        // Nothing recorded means nothing to contradict: an account that has not signed in since this
        // shipped should not have its existing token rejected. Otherwise the token is live while its
        // session is one of the account's current ones.
        return string.IsNullOrEmpty(current) || Parse(current).Contains(sessionId, StringComparer.Ordinal);
    }

    /// <summary>Splits the stored value into session ids, newest last. A plain single id — the shape
    /// stored before more than one session was allowed — parses as a list of one.</summary>
    private static List<string> Parse(string? stored) =>
        string.IsNullOrEmpty(stored)
            ? []
            : [.. stored.Split(Separator, StringSplitOptions.RemoveEmptyEntries)];

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
