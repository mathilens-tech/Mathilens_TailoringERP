namespace MathilensERP.Shared.Authorization;

/// <summary>
/// The roles a tailoring shop actually has, and what each one may do.
///
/// Permissions are fixed per role rather than editable per user: a shop with six staff does not
/// want a permission matrix to administer, and roles that mean something ("front desk", "tailor")
/// survive staff turnover in a way per-person checklists do not. Individual overrides can be
/// layered on later without changing any of the enforcement below.
/// </summary>
public static class AppRoles
{
    /// <summary>The shop owner. Everything, including user management — there must always be someone who can grant access.</summary>
    public const string Owner = nameof(Owner);

    /// <summary>Runs the shop day to day. Everything operational, but cannot change who has access.</summary>
    public const string Manager = nameof(Manager);

    /// <summary>Takes orders and payments at the counter. Customers, orders and billing; no staff records or configuration.</summary>
    public const string FrontDesk = nameof(FrontDesk);

    /// <summary>Does the work. Sees the orders assigned to the shop and moves them along; no money, no customer records to edit.</summary>
    public const string Tailor = nameof(Tailor);

    public static readonly IReadOnlyList<string> All = [Owner, Manager, FrontDesk, Tailor];

    private static readonly IReadOnlyList<string> ManagerPermissions =
    [
        Permissions.CustomersView, Permissions.CustomersManage,
        Permissions.MeasurementsView, Permissions.MeasurementsManage,
        Permissions.EmployeesView, Permissions.EmployeesManage,
        Permissions.OrdersView, Permissions.OrdersManage,
        Permissions.InvoicesView, Permissions.InvoicesManage,
        Permissions.WhatsAppView, Permissions.WhatsAppManage,
        Permissions.ReportsView,
        Permissions.PricingView, Permissions.PricingManage,
        Permissions.InventoryView, Permissions.InventoryManage,
        Permissions.SettingsView, Permissions.SettingsManage,
        Permissions.ActivityView,
        Permissions.UsersView,
    ];

    private static readonly IReadOnlyList<string> FrontDeskPermissions =
    [
        Permissions.CustomersView, Permissions.CustomersManage,
        Permissions.MeasurementsView, Permissions.MeasurementsManage,
        Permissions.OrdersView, Permissions.OrdersManage,
        Permissions.InvoicesView, Permissions.InvoicesManage,
        Permissions.WhatsAppView, Permissions.WhatsAppManage,
        Permissions.PricingView,
        Permissions.InventoryView,
    ];

    private static readonly IReadOnlyList<string> TailorPermissions =
    [
        Permissions.CustomersView,
        Permissions.MeasurementsView,
        Permissions.OrdersView, Permissions.OrdersManage,
    ];

    private static readonly Dictionary<string, IReadOnlyList<string>> ByRole = new(StringComparer.OrdinalIgnoreCase)
    {
        [Owner] = Permissions.All,
        [Manager] = ManagerPermissions,
        [FrontDesk] = FrontDeskPermissions,
        [Tailor] = TailorPermissions,
    };

    /// <summary>
    /// What the given roles grant, combined. An unknown role contributes nothing rather than
    /// throwing — a stale role claim in an old token must not crash the request, and a role the
    /// shop created itself carries only what it has been given on the User Rights screen.
    ///
    /// The sets above are written in terms of <c>Manage</c>; this widens them to the individual
    /// actions endpoints now demand.
    /// </summary>
    public static IReadOnlyList<string> PermissionsFor(IEnumerable<string> roles) =>
        Permissions.Expand(roles.Where(ByRole.ContainsKey).SelectMany(role => ByRole[role]));

    /// <summary>True for the four roles shipped with the system, which cannot be renamed or removed.</summary>
    public static bool IsBuiltIn(string role) => ByRole.ContainsKey(role);

    public static bool IsKnownRole(string role) => ByRole.ContainsKey(role);
}
