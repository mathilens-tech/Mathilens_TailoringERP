using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Shared.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Identity;

/// <summary>
/// Reads the assignable role names out of Identity's own role table.
///
/// Built-in roles come first and in their shipped order — Owner, Manager, Front Desk, Tailor is a
/// ladder, and sorting the whole list alphabetically would bury Owner in the middle of whatever the
/// shop has since added.
/// </summary>
public sealed class RoleCatalog : IRoleCatalog
{
    private readonly RoleManager<ApplicationRole> _roleManager;

    public RoleCatalog(RoleManager<ApplicationRole> roleManager)
    {
        _roleManager = roleManager;
    }

    public async Task<IReadOnlyList<string>> ListRoleNamesAsync(CancellationToken cancellationToken)
    {
        var names = await _roleManager.Roles
            .Select(r => r.Name!)
            .Where(name => name != null)
            .ToListAsync(cancellationToken);

        return Order(names);
    }

    public Task<bool> RoleExistsAsync(string role, CancellationToken cancellationToken) =>
        _roleManager.Roles.AnyAsync(r => r.NormalizedName == role.ToUpperInvariant(), cancellationToken);

    /// <summary>Built-ins in shipped order, then everything the shop added, alphabetically.</summary>
    public static IReadOnlyList<string> Order(IEnumerable<string> names)
    {
        var all = names.ToList();

        return AppRoles.All
            .Where(builtIn => all.Contains(builtIn, StringComparer.OrdinalIgnoreCase))
            .Concat(all.Where(name => !AppRoles.IsBuiltIn(name)).OrderBy(name => name, StringComparer.OrdinalIgnoreCase))
            .ToList();
    }
}
