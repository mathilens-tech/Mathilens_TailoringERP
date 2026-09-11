using System.Text.Json;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Settings;
using MathilensERP.Domain.Settings;
using MathilensERP.Shared.Authorization;
using MathilensERP.Shared.Results;
using Microsoft.Extensions.Caching.Memory;

namespace MathilensERP.Application.Authorization;

/// <summary>
/// Resolves role permissions from the shop's own configuration, falling back to the built-in sets
/// in <see cref="AppRoles"/> for any role never edited.
///
/// Stored in the shop-level settings store, one row per role holding a JSON array — the same
/// mechanism as measurement templates, and for the same reason: this is configuration, it is tiny,
/// and it needs no schema of its own.
///
/// CACHED, deliberately. <c>PermissionsForAsync</c> runs on the authorization path of every
/// request, so reading a settings row each time would add a database round trip to the whole API.
/// The whole map is held as one cache entry and dropped on write, which is why an edit takes
/// effect on the very next request rather than when a token expires.
/// </summary>
public sealed class RolePermissionService : IRolePermissionService
{
    /// <summary>
    /// Where one role's configured rights live. Public because a rename has to carry the row across
    /// with the role — see <c>RoleAdminService</c>.
    /// </summary>
    public const string KeyPrefix = "Authorization.RolePermissions.";

    private const string CacheKey = "Authorization.RolePermissions.All";

    /// <summary>Bounds how long a stale map could survive a write made by another instance.</summary>
    private static readonly TimeSpan CacheLifetime = TimeSpan.FromMinutes(5);

    private readonly ISettingRepository _settingRepository;
    private readonly IRoleCatalog _roleCatalog;
    private readonly IMemoryCache _cache;

    public RolePermissionService(ISettingRepository settingRepository, IRoleCatalog roleCatalog, IMemoryCache cache)
    {
        _settingRepository = settingRepository;
        _roleCatalog = roleCatalog;
        _cache = cache;
    }

    /// <summary>
    /// Deliberately does not check the role still exists.
    ///
    /// This runs on the authorization path of every request, and a role the shop has since deleted
    /// resolves to nothing anyway — so the check would buy a database read per call to reach the
    /// same answer. A role the shop created carries exactly what it has been granted, and nothing
    /// until it has been.
    /// </summary>
    public async Task<IReadOnlyList<string>> PermissionsForAsync(IEnumerable<string> roles, CancellationToken cancellationToken)
    {
        var overrides = await GetOverridesAsync(cancellationToken);

        return roles
            .SelectMany(role => Resolve(role, overrides))
            .Distinct(StringComparer.Ordinal)
            .OrderBy(permission => permission, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<RolePermissionMatrixDto> GetMatrixAsync(CancellationToken cancellationToken)
    {
        var overrides = await GetOverridesAsync(cancellationToken);

        // Screens and the individual actions they offer, straight from the permission catalogue —
        // a module gains a checkbox by gaining an action there and nowhere else. The Manage
        // umbrellas are left out: they are what the built-in sets are written in terms of, not
        // something to tick when every action underneath has its own box.
        var screens = Permissions.ModuleOrder
            .Select(module => new ScreenPermissionsDto(
                module,
                Permissions.ActionsByModule[module]
                    .Select(action => new ScreenPermissionDto($"{module}.{action}", action))
                    .ToList()))
            .ToList();

        var roles = (await _roleCatalog.ListRoleNamesAsync(cancellationToken))
            .Select(role => new RolePermissionsDto(
                role,
                Granular(Resolve(role, overrides)),
                IsEditable: !IsOwner(role),
                IsCustomised: !IsOwner(role) && overrides.ContainsKey(role)))
            .ToList();

        return new RolePermissionMatrixDto(screens, roles);
    }

    public async Task<Result<RolePermissionsDto>> SetPermissionsAsync(
        string role,
        IReadOnlyList<string> permissions,
        CancellationToken cancellationToken)
    {
        var failure = await ValidateAsync(role, permissions, cancellationToken);
        if (failure is not null)
        {
            return Result.Failure<RolePermissionsDto>(failure);
        }

        // Ordered and de-duplicated on the way in, so the stored value is comparable and the grid
        // reads back the same regardless of the order boxes were ticked.
        var normalized = permissions
            .Distinct(StringComparer.Ordinal)
            .OrderBy(p => p, StringComparer.Ordinal)
            .ToList();

        var key = KeyPrefix + role;
        var setting = await _settingRepository.GetByKeyAsync(key, cancellationToken);
        if (setting is null)
        {
            _settingRepository.Add(Setting.Create(key, JsonSerializer.Serialize(normalized)));
        }
        else
        {
            setting.UpdateValue(JsonSerializer.Serialize(normalized));
        }

        await _settingRepository.SaveChangesAsync(cancellationToken);
        _cache.Remove(CacheKey);

        return new RolePermissionsDto(role, normalized, IsEditable: true, IsCustomised: true);
    }

    public async Task<Result<RolePermissionsDto>> ResetPermissionsAsync(string role, CancellationToken cancellationToken)
    {
        if (!await _roleCatalog.RoleExistsAsync(role, cancellationToken))
        {
            return Result.Failure<RolePermissionsDto>(
                Error.Validation("Roles.UnknownRole", $"'{role}' is not a role in this system."));
        }

        if (IsOwner(role))
        {
            return Result.Failure<RolePermissionsDto>(OwnerIsFixed());
        }

        var setting = await _settingRepository.GetByKeyAsync(KeyPrefix + role, cancellationToken);
        if (setting is not null)
        {
            _settingRepository.Remove(setting);
            await _settingRepository.SaveChangesAsync(cancellationToken);
            _cache.Remove(CacheKey);
        }

        return new RolePermissionsDto(role, Granular(AppRoles.PermissionsFor([role])), IsEditable: true, IsCustomised: false);
    }

    private async Task<Error?> ValidateAsync(string role, IReadOnlyList<string> permissions, CancellationToken cancellationToken)
    {
        if (!await _roleCatalog.RoleExistsAsync(role, cancellationToken))
        {
            return Error.Validation("Roles.UnknownRole", $"'{role}' is not a role in this system.");
        }

        if (IsOwner(role))
        {
            return OwnerIsFixed();
        }

        var unknown = permissions.Where(p => !Permissions.All.Contains(p, StringComparer.Ordinal)).ToList();
        return unknown.Count > 0
            ? Error.Validation("Roles.UnknownPermission", $"Not a permission in this system: {string.Join(", ", unknown)}.")
            : null;
    }

    /// <summary>
    /// Owner is fixed at every permission and cannot be edited. It is the only role guaranteed to
    /// carry <c>Users.Manage</c>; a shop that removed it would have nobody left able to grant
    /// access to anyone — including to undo that very change.
    /// </summary>
    private static Error OwnerIsFixed() => Error.Validation(
        "Roles.OwnerIsFixed",
        "Owner always has every permission and cannot be changed — otherwise nobody would be left able to grant access.");

    private static bool IsOwner(string role) => string.Equals(role, AppRoles.Owner, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Drops the <c>Manage</c> umbrellas before the rights grid sees a role's permissions.
    ///
    /// The grid ticks individual actions and sends back what it holds. Leaving a <c>Manage</c> in
    /// that set would make unticking impossible: the box for it does not exist, so it would ride
    /// along untouched into the save and expand straight back into everything it had just been
    /// asked to take away.
    /// </summary>
    private static IReadOnlyList<string> Granular(IEnumerable<string> permissions) =>
        permissions.Where(p => Permissions.Granular.Contains(p, StringComparer.Ordinal)).ToList();

    /// <summary>
    /// What one role actually grants.
    ///
    /// Widened through <see cref="Permissions.Expand"/> on the way out, because both sources can
    /// still speak in <c>Manage</c>: the built-in sets are written that way, and so is every
    /// override stored before the actions were split apart. A role the shop added itself has no
    /// built-in set to fall back on, so without an override it grants nothing.
    /// </summary>
    private static IReadOnlyList<string> Resolve(string role, IReadOnlyDictionary<string, IReadOnlyList<string>> overrides) =>
        IsOwner(role) ? Permissions.All
        : overrides.TryGetValue(role, out var configured) ? Permissions.Expand(configured)
        : AppRoles.PermissionsFor([role]);

    private async Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> GetOverridesAsync(CancellationToken cancellationToken)
    {
        if (_cache.TryGetValue(CacheKey, out IReadOnlyDictionary<string, IReadOnlyList<string>>? cached) && cached is not null)
        {
            return cached;
        }

        var stored = await _settingRepository.ListByKeyPrefixAsync(KeyPrefix, cancellationToken);
        var overrides = new Dictionary<string, IReadOnlyList<string>>(StringComparer.OrdinalIgnoreCase);

        foreach (var setting in stored)
        {
            // Owner alone is skipped — it is fixed at everything. Any other name is honoured,
            // including the roles a shop has created for itself.
            var role = setting.Key[KeyPrefix.Length..];
            if (IsOwner(role))
            {
                continue;
            }

            // A row that no longer parses (hand-edited in the database) falls back to the built-in
            // set rather than silently granting nothing and locking that role out of everything.
            try
            {
                if (JsonSerializer.Deserialize<List<string>>(setting.Value) is { } permissions)
                {
                    overrides[role] = permissions;
                }
            }
            catch (JsonException)
            {
                // Intentionally skipped — Resolve falls back to the default for this role.
            }
        }

        _cache.Set(CacheKey, (IReadOnlyDictionary<string, IReadOnlyList<string>>)overrides, CacheLifetime);
        return overrides;
    }
}
