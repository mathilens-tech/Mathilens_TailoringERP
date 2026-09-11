namespace MathilensERP.Application.Common.Interfaces;

/// <summary>
/// Port for resolving the authenticated caller, per 01_ARCHITECTURE.md § 9.2 — Application
/// depends only on this abstraction, never on ASP.NET Core's HttpContext directly.
/// Implemented in Infrastructure.
/// </summary>
public interface ICurrentUserService
{
    Guid? UserId { get; }

    /// <summary>The caller's display name, for stamping into records that must stay readable after the login changes or goes away.</summary>
    string? UserName { get; }
}
