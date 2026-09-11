using MathilensERP.Application.Authorization;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Settings;
using MathilensERP.Shared.Authorization;
using MathilensERP.Shared.Results;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Identity;

/// <summary>
/// Create, rename and delete the roles a shop hands out, over Identity's role store.
///
/// A role's rights live in the settings store keyed by name (see <see cref="RolePermissionService"/>),
/// not by id, so a rename has to carry that row across with it — otherwise renaming a role silently
/// strips it of everything it was allowed to do.
/// </summary>
public sealed class RoleAdminService : IRoleAdminService
{
    /// <summary>Long enough for "Assistant Manager", short enough to fit a dropdown.</summary>
    private const int MaxNameLength = 40;

    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly Persistence.ApplicationDbContext _dbContext;
    private readonly ISettingRepository _settingRepository;

    public RoleAdminService(
        RoleManager<ApplicationRole> roleManager,
        Persistence.ApplicationDbContext dbContext,
        ISettingRepository settingRepository)
    {
        _roleManager = roleManager;
        _dbContext = dbContext;
        _settingRepository = settingRepository;
    }

    public async Task<IReadOnlyList<AppRoleDto>> ListAsync(CancellationToken cancellationToken)
    {
        var roles = await _roleManager.Roles.ToListAsync(cancellationToken);

        // One grouped count rather than a query per role: this screen lists every role the shop has,
        // and the count is what decides whether Delete is offered at all.
        var counts = await _dbContext.UserRoles
            .GroupBy(ur => ur.RoleId)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count, cancellationToken);

        var ordered = RoleCatalog.Order(roles.Select(r => r.Name!).Where(name => name is not null));

        return ordered
            .Select(name => roles.First(r => string.Equals(r.Name, name, StringComparison.OrdinalIgnoreCase)))
            .Select(role => new AppRoleDto(
                role.Id,
                role.Name!,
                AppRoles.IsBuiltIn(role.Name!),
                counts.TryGetValue(role.Id, out var count) ? count : 0))
            .ToList();
    }

    public async Task<Result<AppRoleDto>> CreateAsync(string name, CancellationToken cancellationToken)
    {
        var trimmed = (name ?? string.Empty).Trim();

        if (Validate(trimmed) is { } invalid)
        {
            return Result.Failure<AppRoleDto>(invalid);
        }

        if (await _roleManager.RoleExistsAsync(trimmed))
        {
            return Result.Failure<AppRoleDto>(
                Error.Conflict("Roles.AlreadyExists", $"A role called '{trimmed}' already exists."));
        }

        var role = new ApplicationRole { Name = trimmed };
        var created = await _roleManager.CreateAsync(role);
        if (!created.Succeeded)
        {
            return Result.Failure<AppRoleDto>(Error.Validation(
                "Roles.CreateFailed",
                string.Join(" ", created.Errors.Select(e => e.Description))));
        }

        // No rights at all to begin with. A new role granting nothing is a role that has to be
        // described on User Rights before anyone can be put in it — which is the point of adding it.
        return Result.Success(new AppRoleDto(role.Id, trimmed, IsBuiltIn: false, UserCount: 0));
    }

    public async Task<Result<AppRoleDto>> RenameAsync(Guid id, string name, CancellationToken cancellationToken)
    {
        var trimmed = (name ?? string.Empty).Trim();

        if (Validate(trimmed) is { } invalid)
        {
            return Result.Failure<AppRoleDto>(invalid);
        }

        var role = await _roleManager.FindByIdAsync(id.ToString());
        if (role is null)
        {
            return Result.Failure<AppRoleDto>(Error.NotFound("Roles.NotFound", $"No role was found with id '{id}'."));
        }

        var currentName = role.Name!;

        if (AppRoles.IsBuiltIn(currentName))
        {
            return Result.Failure<AppRoleDto>(BuiltInIsFixed(currentName));
        }

        if (!string.Equals(currentName, trimmed, StringComparison.OrdinalIgnoreCase)
            && await _roleManager.RoleExistsAsync(trimmed))
        {
            return Result.Failure<AppRoleDto>(
                Error.Conflict("Roles.AlreadyExists", $"A role called '{trimmed}' already exists."));
        }

        var renamed = await _roleManager.SetRoleNameAsync(role, trimmed);
        if (!renamed.Succeeded)
        {
            return Result.Failure<AppRoleDto>(Error.Validation(
                "Roles.RenameFailed",
                string.Join(" ", renamed.Errors.Select(e => e.Description))));
        }

        await _roleManager.UpdateAsync(role);
        await MoveRightsAsync(currentName, trimmed, cancellationToken);

        var userCount = await _dbContext.UserRoles.CountAsync(ur => ur.RoleId == role.Id, cancellationToken);
        return Result.Success(new AppRoleDto(role.Id, trimmed, IsBuiltIn: false, userCount));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var role = await _roleManager.FindByIdAsync(id.ToString());
        if (role is null)
        {
            return Result.Failure(Error.NotFound("Roles.NotFound", $"No role was found with id '{id}'."));
        }

        if (AppRoles.IsBuiltIn(role.Name!))
        {
            return Result.Failure(BuiltInIsFixed(role.Name!));
        }

        // Checked here as well as offered-or-not on the screen: deleting a role out from under the
        // people holding it would leave them signed in and able to do nothing, with no obvious cause.
        var userCount = await _dbContext.UserRoles.CountAsync(ur => ur.RoleId == role.Id, cancellationToken);
        if (userCount > 0)
        {
            return Result.Failure(Error.Conflict(
                "Roles.InUse",
                userCount == 1
                    ? $"One user still has the '{role.Name}' role. Move them to another role first."
                    : $"{userCount} users still have the '{role.Name}' role. Move them to another role first."));
        }

        var deleted = await _roleManager.DeleteAsync(role);
        if (!deleted.Succeeded)
        {
            return Result.Failure(Error.Validation(
                "Roles.DeleteFailed",
                string.Join(" ", deleted.Errors.Select(e => e.Description))));
        }

        await RemoveRightsAsync(role.Name!, cancellationToken);
        return Result.Success();
    }

    private static Error? Validate(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Error.Validation("Roles.NameRequired", "Enter a name for this role.");
        }

        if (name.Length > MaxNameLength)
        {
            return Error.Validation("Roles.NameTooLong", $"A role name cannot be longer than {MaxNameLength} characters.");
        }

        // Role names travel in the URL of the rights endpoints and in a JWT claim, so they stay to
        // characters that survive both without escaping.
        return name.All(c => char.IsLetterOrDigit(c) || c is ' ' or '-' or '_')
            ? null
            : Error.Validation("Roles.NameInvalid", "A role name can use letters, numbers, spaces, hyphens and underscores only.");
    }

    private static Error BuiltInIsFixed(string role) => Error.Validation(
        "Roles.BuiltIn",
        $"'{role}' is built in and cannot be renamed or deleted. You can still change what it is allowed to do.");

    /// <summary>Carries a renamed role's configured rights across to its new name.</summary>
    private async Task MoveRightsAsync(string fromRole, string toRole, CancellationToken cancellationToken)
    {
        var existing = await _settingRepository.GetByKeyAsync(RolePermissionService.KeyPrefix + fromRole, cancellationToken);
        if (existing is null)
        {
            return;
        }

        _settingRepository.Remove(existing);
        _settingRepository.Add(Domain.Settings.Setting.Create(RolePermissionService.KeyPrefix + toRole, existing.Value));
        await _settingRepository.SaveChangesAsync(cancellationToken);
    }

    private async Task RemoveRightsAsync(string role, CancellationToken cancellationToken)
    {
        var existing = await _settingRepository.GetByKeyAsync(RolePermissionService.KeyPrefix + role, cancellationToken);
        if (existing is null)
        {
            return;
        }

        _settingRepository.Remove(existing);
        await _settingRepository.SaveChangesAsync(cancellationToken);
    }
}
