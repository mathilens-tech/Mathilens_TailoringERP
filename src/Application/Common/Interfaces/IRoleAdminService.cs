using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Common.Interfaces;

/// <summary>
/// The roles the shop can hand out, as data rather than as a fixed list in code.
///
/// The four built-in roles are still shipped and still cannot be renamed or removed — they are what
/// the default permission sets are written against, and Owner in particular has to keep existing so
/// somebody can always grant access. Everything a shop adds beyond them starts with no rights at all
/// and is given them on the User Rights screen, which is the only safe default for a role nobody has
/// described yet.
/// </summary>
public interface IRoleAdminService
{
    Task<IReadOnlyList<AppRoleDto>> ListAsync(CancellationToken cancellationToken);

    Task<Result<AppRoleDto>> CreateAsync(string name, CancellationToken cancellationToken);

    Task<Result<AppRoleDto>> RenameAsync(Guid id, string name, CancellationToken cancellationToken);

    /// <summary>Refused while any user still holds the role, and for the built-in four.</summary>
    Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken);
}

/// <summary>
/// One assignable role.
/// </summary>
/// <param name="IsBuiltIn">Shipped with the system: it can be given different rights, but not renamed or deleted.</param>
/// <param name="UserCount">How many people hold it — what makes a delete refusable before it is attempted.</param>
public sealed record AppRoleDto(Guid Id, string Name, bool IsBuiltIn, int UserCount);

/// <summary>
/// Just the role names, for the places that need to know a role exists without administering it.
///
/// Deliberately separate from <see cref="IRoleAdminService"/>: the permission resolver needs this,
/// and role administration needs the permission resolver, so one interface for both would be a
/// dependency cycle the container could not build.
/// </summary>
public interface IRoleCatalog
{
    Task<IReadOnlyList<string>> ListRoleNamesAsync(CancellationToken cancellationToken);

    Task<bool> RoleExistsAsync(string role, CancellationToken cancellationToken);
}
