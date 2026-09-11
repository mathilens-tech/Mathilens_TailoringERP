namespace MathilensERP.Application.Common.Interfaces;

/// <summary>
/// One signed-in place per account.
///
/// The shop's rule: signing in somewhere new ends wherever the account was signed in before, with
/// the losing screen told why rather than silently failing. Access tokens are stateless JWTs, so
/// revoking a refresh token only stops renewal — the old screen keeps working until its access
/// token expires. Cutting it off at once needs the token to carry a session id and every request to
/// check that it is still the current one, which is what this exists for.
/// </summary>
public interface IActiveSessionService
{
    /// <summary>Claim type carrying the session id. Short, because it is in every token.</summary>
    const string SessionClaimType = "sid";

    /// <summary>Records a new session as the only live one for this user, retiring any predecessor.</summary>
    Task StartSessionAsync(Guid userId, string sessionId, CancellationToken cancellationToken);

    /// <summary>
    /// Whether this session is still the account's current one.
    ///
    /// Called on every authenticated request, so it answers from cache in the ordinary case. A
    /// token with no session id at all is accepted: those were issued before this existed, and
    /// rejecting them would sign out everybody the moment it shipped.
    /// </summary>
    Task<bool> IsCurrentAsync(Guid userId, string? sessionId, CancellationToken cancellationToken);

    /// <summary>Ends the account's session outright, so nothing outstanding is accepted.</summary>
    Task ClearSessionAsync(Guid userId, CancellationToken cancellationToken);
}
