using System.Text.Json;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Settings;
using MathilensERP.Domain.Settings;
using MathilensERP.Application.Authorization;
using MathilensERP.Shared.Authorization;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Authorization;

public class RolePermissionServiceTests
{
    private const string KeyPrefix = "Authorization.RolePermissions.";

    private readonly ISettingRepository _settings = Substitute.For<ISettingRepository>();

    /// <summary>Stands in for the role store: the four built-ins exist, nothing else does.</summary>
    private readonly IRoleCatalog _roles = Substitute.For<IRoleCatalog>();

    public RolePermissionServiceTests()
    {
        _roles.ListRoleNamesAsync(Arg.Any<CancellationToken>()).Returns(AppRoles.All);
        _roles.RoleExistsAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(call => AppRoles.IsKnownRole(call.Arg<string>() ?? string.Empty));
    }

    private RolePermissionService Service(params Setting[] stored)
    {
        _settings.ListByKeyPrefixAsync(KeyPrefix, Arg.Any<CancellationToken>()).Returns(stored);
        // A fresh cache per service, so one test's map can never leak into another's.
        return new RolePermissionService(_settings, _roles, new MemoryCache(new MemoryCacheOptions()));
    }

    private static Setting Stored(string role, params string[] permissions) =>
        Setting.Create(KeyPrefix + role, JsonSerializer.Serialize(permissions));

    [Fact]
    public async Task PermissionsFor_WithNothingConfigured_UsesTheBuiltInSet()
    {
        var permissions = await Service().PermissionsForAsync([AppRoles.Tailor], CancellationToken.None);

        Assert.Equal(AppRoles.PermissionsFor([AppRoles.Tailor]).OrderBy(p => p), permissions.OrderBy(p => p));
    }

    [Fact]
    public async Task PermissionsFor_WithAnOverride_UsesItInsteadOfTheDefault()
    {
        var service = Service(Stored(AppRoles.Tailor, Permissions.OrdersView, Permissions.ReportsView));

        var permissions = await service.PermissionsForAsync([AppRoles.Tailor], CancellationToken.None);

        Assert.Equal([Permissions.OrdersView, Permissions.ReportsView], permissions.OrderBy(p => p, StringComparer.Ordinal));
        // The default granted Customers.View; the override replaces the set rather than adding to it.
        Assert.DoesNotContain(Permissions.CustomersView, permissions);
    }

    [Fact]
    public async Task PermissionsFor_Owner_IsAlwaysEverythingEvenIfARowSaysOtherwise()
    {
        // Owner is the only role guaranteed to be able to grant access. A stored row must not be
        // able to take that away — including one written straight into the database.
        var service = Service(Stored(AppRoles.Owner, Permissions.OrdersView));

        var permissions = await service.PermissionsForAsync([AppRoles.Owner], CancellationToken.None);

        Assert.Equal(Permissions.All.OrderBy(p => p, StringComparer.Ordinal), permissions.OrderBy(p => p, StringComparer.Ordinal));
        Assert.Contains(Permissions.UsersRights, permissions);
    }

    [Fact]
    public async Task PermissionsFor_WithAnUnparsableRow_FallsBackToTheDefault()
    {
        // A hand-edited row must not silently lock a role out of the whole system.
        var service = Service(Setting.Create(KeyPrefix + AppRoles.FrontDesk, "not json"));

        var permissions = await service.PermissionsForAsync([AppRoles.FrontDesk], CancellationToken.None);

        Assert.Equal(AppRoles.PermissionsFor([AppRoles.FrontDesk]).OrderBy(p => p), permissions.OrderBy(p => p));
    }

    [Fact]
    public async Task SetPermissions_ForOwner_IsRefused()
    {
        var result = await Service().SetPermissionsAsync(AppRoles.Owner, [Permissions.OrdersView], CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Roles.OwnerIsFixed", result.Error.Code);
        await _settings.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetPermissions_WithAnUnknownPermission_IsRefused()
    {
        var result = await Service().SetPermissionsAsync(AppRoles.Tailor, ["Orders.Explode"], CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Roles.UnknownPermission", result.Error.Code);
        await _settings.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetPermissions_WithAnUnknownRole_IsRefused()
    {
        var result = await Service().SetPermissionsAsync("Caretaker", [Permissions.OrdersView], CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Roles.UnknownRole", result.Error.Code);
    }

    [Fact]
    public async Task SetPermissions_StoresTheSetAndTakesEffectImmediately()
    {
        var service = Service();
        _settings.GetByKeyAsync(KeyPrefix + AppRoles.Tailor, Arg.Any<CancellationToken>()).Returns((Setting?)null);

        // Warm the cache first, so this also proves the write invalidates it rather than leaving
        // the old answer in place — the whole point of resolving per request.
        await service.PermissionsForAsync([AppRoles.Tailor], CancellationToken.None);

        var result = await service.SetPermissionsAsync(AppRoles.Tailor, [Permissions.ReportsView], CancellationToken.None);

        Assert.True(result.IsSuccess);
        _settings.Received(1).Add(Arg.Is<Setting>(s => s != null && s.Key == KeyPrefix + AppRoles.Tailor));
        await _settings.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());

        _settings.ListByKeyPrefixAsync(KeyPrefix, Arg.Any<CancellationToken>())
            .Returns([Stored(AppRoles.Tailor, Permissions.ReportsView)]);
        var after = await service.PermissionsForAsync([AppRoles.Tailor], CancellationToken.None);
        Assert.Equal([Permissions.ReportsView], after);
    }

    [Fact]
    public async Task GetMatrix_ReportsOnlyIndividualActions_SoUntickingIsExpressible()
    {
        // Tailor's built-in set is written as Orders.Manage. The grid has no box for that, so if
        // it came back in the role's permissions it would ride untouched through a save and expand
        // straight back into every Orders action the user had just cleared.
        var matrix = await Service().GetMatrixAsync(CancellationToken.None);

        var tailor = matrix.Roles.Single(r => r.Role == AppRoles.Tailor);
        Assert.DoesNotContain(tailor.Permissions, p => p.EndsWith(".Manage", StringComparison.Ordinal));
        Assert.Contains(Permissions.OrdersCreate, tailor.Permissions);
    }

    [Fact]
    public async Task GetMatrix_MarksOwnerAsNotEditableAndEveryOtherRoleAsEditable()
    {
        var matrix = await Service().GetMatrixAsync(CancellationToken.None);

        Assert.False(matrix.Roles.Single(r => r.Role == AppRoles.Owner).IsEditable);
        Assert.All(matrix.Roles.Where(r => r.Role != AppRoles.Owner), r => Assert.True(r.IsEditable));
    }

    [Fact]
    public async Task GetMatrix_DerivesScreensFromTheCatalogue()
    {
        var matrix = await Service().GetMatrixAsync(CancellationToken.None);

        // Every individual action is represented exactly once, so a module added later needs no
        // edit here.
        var flattened = matrix.Screens.SelectMany(s => s.Permissions.Select(p => p.Permission)).ToList();
        Assert.Equal(
            Permissions.Granular.OrderBy(p => p, StringComparer.Ordinal),
            flattened.OrderBy(p => p, StringComparer.Ordinal));

        // Manage is an umbrella the built-in sets are written in terms of, not a box to tick when
        // every action underneath it has one of its own.
        Assert.DoesNotContain(matrix.Screens.SelectMany(s => s.Permissions), p => p.Action == "Manage");

        // Reports defines only viewing, so it is one checkbox and no more.
        var reports = matrix.Screens.Single(s => s.Screen == "Reports");
        Assert.Equal("View", Assert.Single(reports.Permissions).Action);
    }

    [Fact]
    public async Task ResetPermissions_ForOwner_IsRefused()
    {
        var result = await Service().ResetPermissionsAsync(AppRoles.Owner, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Roles.OwnerIsFixed", result.Error.Code);
    }

    [Fact]
    public async Task ResetPermissions_RemovesTheOverrideAndReturnsTheBuiltInSet()
    {
        var stored = Stored(AppRoles.Tailor, Permissions.ReportsView);
        var service = Service(stored);
        _settings.GetByKeyAsync(KeyPrefix + AppRoles.Tailor, Arg.Any<CancellationToken>()).Returns(stored);

        var result = await service.ResetPermissionsAsync(AppRoles.Tailor, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.IsCustomised);
        // Individual actions only. The grid ticks those, and a Manage riding along in the set it
        // sends back would expand into everything the next time it was saved.
        Assert.Equal(
            AppRoles.PermissionsFor([AppRoles.Tailor]).Where(Permissions.Granular.Contains),
            result.Value.Permissions);
        Assert.DoesNotContain(result.Value.Permissions, p => p.EndsWith(".Manage", StringComparison.Ordinal));
        _settings.Received(1).Remove(stored);
    }
}
