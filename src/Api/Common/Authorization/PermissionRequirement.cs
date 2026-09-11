using System.Security.Claims;
using MathilensERP.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;

namespace MathilensERP.Api.Common.Authorization;

/// <summary>The permission an endpoint demands, e.g. <c>Orders.Manage</c>.</summary>
public sealed class PermissionRequirement : IAuthorizationRequirement
{
    public PermissionRequirement(string permission)
    {
        Permission = permission;
    }

    public string Permission { get; }
}

/// <summary>
/// Grants access when any role on the caller's token carries the required permission.
///
/// Permissions are resolved from the role at request time rather than stamped into the token,
/// so changing what a role may do takes effect on the next request instead of waiting for every
/// outstanding access token to expire. That resolution now runs through
/// <see cref="IRolePermissionService"/>, which layers the shop's own configuration over the
/// built-in sets — the reason it is worth a database-backed lookup here is exactly that
/// immediacy, and the service caches so it does not cost a round trip per request.
/// </summary>
public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IRolePermissionService _rolePermissions;

    public PermissionAuthorizationHandler(IRolePermissionService rolePermissions)
    {
        _rolePermissions = rolePermissions;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        var roles = context.User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        if (roles.Count == 0)
        {
            return;
        }

        var permissions = await _rolePermissions.PermissionsForAsync(roles, CancellationToken.None);

        if (permissions.Contains(requirement.Permission, StringComparer.Ordinal))
        {
            context.Succeed(requirement);
        }
    }
}
