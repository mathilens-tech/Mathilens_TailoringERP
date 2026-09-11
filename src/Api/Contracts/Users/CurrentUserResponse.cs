namespace MathilensERP.Api.Contracts.Users;

/// <summary><paramref name="Permissions"/> is what <paramref name="Roles"/> resolves to, sent so the client doesn't have to know the role-to-permission mapping.</summary>
/// <param name="FullName">Null for an account created before names were recorded — screens show the email instead.</param>
public sealed record CurrentUserResponse(
    Guid Id,
    string? Email,
    string? FullName,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions);
