using MathilensERP.Application.Authorization;

namespace MathilensERP.Application.Common.Interfaces;

/// <summary>
/// Resolves what a role may do, honouring any per-role overrides the shop has configured and
/// falling back to the built-in sets in <c>AppRoles</c>.
///
/// This sits on the authorization path for every request, so implementations must cache — the
/// alternative is a database read per authorized call.
/// </summary>
public interface IRolePermissionService
{
    /// <summary>The permissions the given roles grant, combined and de-duplicated.</summary>
    Task<IReadOnlyList<string>> PermissionsForAsync(IEnumerable<string> roles, CancellationToken cancellationToken);

    /// <summary>Every role and screen, for the rights grid in Settings.</summary>
    Task<RolePermissionMatrixDto> GetMatrixAsync(CancellationToken cancellationToken);

    /// <summary>Replaces one role's permissions wholesale. Rejects Owner and unknown roles.</summary>
    Task<Shared.Results.Result<RolePermissionsDto>> SetPermissionsAsync(
        string role,
        IReadOnlyList<string> permissions,
        CancellationToken cancellationToken);

    /// <summary>Restores a role to its built-in permission set.</summary>
    Task<Shared.Results.Result<RolePermissionsDto>> ResetPermissionsAsync(string role, CancellationToken cancellationToken);
}
