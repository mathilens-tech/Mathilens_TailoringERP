namespace MathilensERP.Application.Authorization;

/// <summary>
/// What one role may do, as the Settings screen shows it.
/// </summary>
/// <param name="IsEditable">
/// False for Owner. Owner always holds every permission and cannot be changed: it is the only role
/// guaranteed to carry <c>Users.Manage</c>, and a shop that removed it would have nobody left able
/// to grant access to anyone — including to fix that very mistake.
/// </param>
/// <param name="IsCustomised">False while the role still matches its built-in permission set.</param>
public sealed record RolePermissionsDto(
    string Role,
    IReadOnlyList<string> Permissions,
    bool IsEditable,
    bool IsCustomised);

/// <summary>
/// One screen's row in the rights grid: the module, and the permissions it actually defines.
/// Derived from the permission catalogue rather than listed here, so a module added later appears
/// without anyone editing this file — and a module that only supports viewing (Reports, Activity
/// Log) correctly offers no Manage checkbox instead of a dead one.
/// </summary>
public sealed record ScreenPermissionsDto(string Screen, IReadOnlyList<ScreenPermissionDto> Permissions);

public sealed record ScreenPermissionDto(string Permission, string Action);

/// <summary>Everything the rights screen needs in one call: the grid's columns and its rows.</summary>
public sealed record RolePermissionMatrixDto(
    IReadOnlyList<ScreenPermissionsDto> Screens,
    IReadOnlyList<RolePermissionsDto> Roles);
