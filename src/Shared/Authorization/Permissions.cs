namespace MathilensERP.Shared.Authorization;

/// <summary>
/// What a user is allowed to do, as a flat set of "Module.Action" strings.
///
/// Each module names the individual things that can be done on its screen — Create, Edit, Delete,
/// and whatever else that screen actually offers — rather than a single "Manage" covering all of
/// them. A shop handing out access wants to let the front desk raise an order without also letting
/// them delete one, and one blanket tick could not express that.
///
/// <see cref="Manage"/> survives as an umbrella rather than a permission of its own: it is what the
/// built-in roles are written in terms of, and what every override stored before the split holds.
/// Holding <c>Customers.Manage</c> grants every one of Customers' actions — see
/// <see cref="Expand"/> — so no role loses access on the day the split lands, and endpoints can be
/// guarded by the precise action from the start.
/// </summary>
public static class Permissions
{
    public const string View = nameof(View);

    /// <summary>Every action on a module at once. Granted to a role, never demanded by an endpoint.</summary>
    public const string Manage = nameof(Manage);

    public const string Create = nameof(Create);
    public const string Edit = nameof(Edit);
    public const string Delete = nameof(Delete);
    public const string Import = nameof(Import);
    public const string Retire = nameof(Retire);
    public const string Assign = nameof(Assign);
    public const string Status = nameof(Status);
    public const string Payment = nameof(Payment);
    public const string Void = nameof(Void);
    public const string Send = nameof(Send);
    public const string Password = nameof(Password);
    public const string Rights = nameof(Rights);
    public const string Roles = nameof(Roles);

    public static class Modules
    {
        public const string Customers = nameof(Customers);
        public const string Measurements = nameof(Measurements);
        public const string Employees = nameof(Employees);
        public const string Orders = nameof(Orders);
        public const string Invoices = nameof(Invoices);
        public const string WhatsApp = nameof(WhatsApp);
        public const string Reports = nameof(Reports);
        public const string Pricing = nameof(Pricing);
        public const string Inventory = nameof(Inventory);
        public const string Settings = nameof(Settings);
        public const string Activity = nameof(Activity);
        public const string Users = nameof(Users);
    }

    public const string CustomersView = $"{Modules.Customers}.{View}";
    public const string CustomersManage = $"{Modules.Customers}.{Manage}";
    public const string CustomersCreate = $"{Modules.Customers}.{Create}";
    public const string CustomersEdit = $"{Modules.Customers}.{Edit}";
    public const string CustomersDelete = $"{Modules.Customers}.{Delete}";
    public const string CustomersImport = $"{Modules.Customers}.{Import}";

    public const string MeasurementsView = $"{Modules.Measurements}.{View}";
    public const string MeasurementsManage = $"{Modules.Measurements}.{Manage}";
    public const string MeasurementsCreate = $"{Modules.Measurements}.{Create}";
    public const string MeasurementsEdit = $"{Modules.Measurements}.{Edit}";

    public const string EmployeesView = $"{Modules.Employees}.{View}";
    public const string EmployeesManage = $"{Modules.Employees}.{Manage}";
    public const string EmployeesCreate = $"{Modules.Employees}.{Create}";
    public const string EmployeesEdit = $"{Modules.Employees}.{Edit}";
    public const string EmployeesRetire = $"{Modules.Employees}.{Retire}";
    public const string EmployeesImport = $"{Modules.Employees}.{Import}";

    public const string OrdersView = $"{Modules.Orders}.{View}";
    public const string OrdersManage = $"{Modules.Orders}.{Manage}";
    public const string OrdersCreate = $"{Modules.Orders}.{Create}";
    public const string OrdersEdit = $"{Modules.Orders}.{Edit}";
    public const string OrdersDelete = $"{Modules.Orders}.{Delete}";
    public const string OrdersAssign = $"{Modules.Orders}.{Assign}";
    public const string OrdersStatus = $"{Modules.Orders}.{Status}";

    public const string InvoicesView = $"{Modules.Invoices}.{View}";
    public const string InvoicesManage = $"{Modules.Invoices}.{Manage}";
    public const string InvoicesCreate = $"{Modules.Invoices}.{Create}";
    public const string InvoicesPayment = $"{Modules.Invoices}.{Payment}";
    public const string InvoicesVoid = $"{Modules.Invoices}.{Void}";

    public const string WhatsAppView = $"{Modules.WhatsApp}.{View}";
    public const string WhatsAppManage = $"{Modules.WhatsApp}.{Manage}";
    public const string WhatsAppSend = $"{Modules.WhatsApp}.{Send}";

    public const string ReportsView = $"{Modules.Reports}.{View}";

    public const string PricingView = $"{Modules.Pricing}.{View}";
    public const string PricingManage = $"{Modules.Pricing}.{Manage}";
    public const string PricingCreate = $"{Modules.Pricing}.{Create}";
    public const string PricingEdit = $"{Modules.Pricing}.{Edit}";
    public const string PricingDelete = $"{Modules.Pricing}.{Delete}";
    public const string PricingImport = $"{Modules.Pricing}.{Import}";

    public const string InventoryView = $"{Modules.Inventory}.{View}";
    public const string InventoryManage = $"{Modules.Inventory}.{Manage}";
    public const string InventoryCreate = $"{Modules.Inventory}.{Create}";

    public const string SettingsView = $"{Modules.Settings}.{View}";
    public const string SettingsManage = $"{Modules.Settings}.{Manage}";
    public const string SettingsEdit = $"{Modules.Settings}.{Edit}";

    public const string ActivityView = $"{Modules.Activity}.{View}";

    public const string UsersView = $"{Modules.Users}.{View}";
    public const string UsersManage = $"{Modules.Users}.{Manage}";
    public const string UsersCreate = $"{Modules.Users}.{Create}";
    public const string UsersEdit = $"{Modules.Users}.{Edit}";
    public const string UsersPassword = $"{Modules.Users}.{Password}";
    public const string UsersRights = $"{Modules.Users}.{Rights}";
    public const string UsersRoles = $"{Modules.Users}.{Roles}";

    /// <summary>
    /// The individual actions each module offers, in the order they read best on the rights grid.
    ///
    /// This is the catalogue everything else is derived from: the policies registered at startup,
    /// the checkboxes on User Rights, and what <c>Manage</c> expands to. A module gains a new action
    /// by being listed here and nowhere else.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> ActionsByModule =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            [Modules.Customers] = [View, Create, Edit, Delete, Import],
            [Modules.Measurements] = [View, Create, Edit],
            [Modules.Employees] = [View, Create, Edit, Retire, Import],
            [Modules.Orders] = [View, Create, Edit, Delete, Assign, Status],
            [Modules.Invoices] = [View, Create, Payment, Void],
            [Modules.WhatsApp] = [View, Send],
            [Modules.Reports] = [View],
            [Modules.Pricing] = [View, Create, Edit, Delete, Import],
            [Modules.Inventory] = [View, Create],
            [Modules.Settings] = [View, Edit],
            [Modules.Activity] = [View],
            [Modules.Users] = [View, Create, Edit, Password, Rights, Roles],
        };

    /// <summary>The modules in menu order, so the rights grid is not at the mercy of dictionary order.</summary>
    public static readonly IReadOnlyList<string> ModuleOrder =
    [
        Modules.Orders, Modules.Customers, Modules.Measurements, Modules.Invoices,
        Modules.Pricing, Modules.Inventory, Modules.Reports, Modules.WhatsApp,
        Modules.Employees, Modules.Users, Modules.Activity, Modules.Settings,
    ];

    /// <summary>
    /// Every permission an endpoint can demand or a role can hold — one policy each at startup.
    ///
    /// Includes the <c>Manage</c> umbrellas so that overrides stored before the actions were split
    /// still validate rather than being rejected as unknown the first time that role is edited.
    /// </summary>
    public static readonly IReadOnlyList<string> All =
        ModuleOrder
            .SelectMany(module => ActionsByModule[module]
                .Select(action => $"{module}.{action}")
                .Concat(HasManageActions(module) ? new[] { $"{module}.{Manage}" } : []))
            .ToList();

    /// <summary>Every granular permission, without the <c>Manage</c> umbrellas — what the rights grid ticks.</summary>
    public static readonly IReadOnlyList<string> Granular =
        ModuleOrder
            .SelectMany(module => ActionsByModule[module].Select(action => $"{module}.{action}"))
            .ToList();

    /// <summary>A module offers a Manage umbrella only if it has something beyond viewing to manage.</summary>
    public static bool HasManageActions(string module) =>
        ActionsByModule.TryGetValue(module, out var actions) && actions.Any(a => a != View);

    /// <summary>
    /// Widens a role's stored permissions to what they actually grant.
    ///
    /// <c>Customers.Manage</c> stands for every action on Customers, which is what lets the
    /// built-in roles and every pre-split override keep working now that endpoints demand the
    /// precise action. Anything already granular passes through untouched.
    /// </summary>
    public static IReadOnlyList<string> Expand(IEnumerable<string> permissions)
    {
        var expanded = new HashSet<string>(StringComparer.Ordinal);

        foreach (var permission in permissions)
        {
            expanded.Add(permission);

            var separator = permission.IndexOf('.');
            if (separator < 0 || !permission.AsSpan(separator + 1).SequenceEqual(Manage))
            {
                continue;
            }

            var module = permission[..separator];
            if (!ActionsByModule.TryGetValue(module, out var actions))
            {
                continue;
            }

            foreach (var action in actions)
            {
                expanded.Add($"{module}.{action}");
            }
        }

        return expanded.OrderBy(p => p, StringComparer.Ordinal).ToList();
    }
}
