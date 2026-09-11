using MathilensERP.Application.Activity;
using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Employees;
using MathilensERP.Application.Inventory;
using MathilensERP.Application.Measurements;
using MathilensERP.Application.Occasions;
using MathilensERP.Application.Orders;
using MathilensERP.Application.Pricing;
using MathilensERP.Application.Reports;
using MathilensERP.Application.Settings;
using MathilensERP.Application.WhatsApp;
using MathilensERP.Application.Authorization;
using MathilensERP.Infrastructure.Billing;
using MathilensERP.Infrastructure.Identity;
using MathilensERP.Infrastructure.Persistence;
using MathilensERP.Infrastructure.Persistence.Activity;
using MathilensERP.Infrastructure.Persistence.Billing;
using MathilensERP.Infrastructure.Persistence.Customers;
using MathilensERP.Infrastructure.Persistence.Employees;
using MathilensERP.Infrastructure.Persistence.Inventory;
using MathilensERP.Infrastructure.Persistence.Interceptors;
using MathilensERP.Infrastructure.Persistence.Measurements;
using MathilensERP.Infrastructure.Persistence.Orders;
using MathilensERP.Infrastructure.Persistence.Pricing;
using MathilensERP.Infrastructure.Persistence.Reports;
using MathilensERP.Infrastructure.Persistence.Settings;
using MathilensERP.Infrastructure.Persistence.WhatsApp;
using MathilensERP.Infrastructure.Services;
using MathilensERP.Infrastructure.WhatsApp;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace MathilensERP.Infrastructure;

/// <summary>
/// Infrastructure's half of the composition root (01_ARCHITECTURE.md § 10 Dependency
/// Injection Strategy) — called once from Api's <c>Program.cs</c>. This is the only place
/// port interfaces defined in Application are bound to their Infrastructure implementations.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException(
                "Connection string 'Default' is not configured (00_MASTER_SPEC.md § 13.1 Environment Variables).");

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<AuditableEntitySaveChangesInterceptor>();

        // Scoped, and the collector shared with the interceptor writing into it: the before-and-after
        // is captured during SaveChanges and read after the command commits, so both halves have to
        // be looking at the same instance for the length of one request.
        services.AddScoped<IEntityChangeCollector, EntityChangeCollector>();
        services.AddScoped<EntityChangeSaveChangesInterceptor>();

        // AddIdentityCore's default token providers (used for password reset, email
        // confirmation, etc.) need IDataProtectionProvider. A full WebApplication host
        // registers this automatically at runtime, but EF Core's design-time host (used by
        // `dotnet ef migrations`) does not — so it is registered explicitly here.
        services.AddDataProtection();

        services.AddDbContext<ApplicationDbContext>((sp, options) =>
            options.UseNpgsql(connectionString)
                .AddInterceptors(
                    sp.GetRequiredService<AuditableEntitySaveChangesInterceptor>(),
                    sp.GetRequiredService<EntityChangeSaveChangesInterceptor>()));

        services
            .AddIdentityCore<ApplicationUser>(options =>
            {
                // 00_MASTER_SPEC.md § 10.4 Password Policy.
                options.Password.RequiredLength = 8;
                options.Password.RequireNonAlphanumeric = false;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.User.RequireUniqueEmail = true;
            })
            .AddRoles<ApplicationRole>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders();

        services
            .AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddScoped<IIdentityService, IdentityService>();
        services.AddScoped<IUserAdminService, UserAdminService>();

        // Two classes rather than one implementing both: RoleAdminService needs the settings store
        // to carry a renamed role's rights across, and RolePermissionService needs the catalogue —
        // folding them together would be a dependency cycle the container could not resolve.
        services.AddScoped<IRoleCatalog, RoleCatalog>();
        services.AddScoped<IRoleAdminService, RoleAdminService>();

        // The resolver itself lives in Application (it is plain policy over a repository port);
        // supplying it a cache implementation is this layer's job. It sits on the authorization
        // path of every request, so it must not read a settings row per call.
        services.AddMemoryCache();
        services.AddScoped<IRolePermissionService, RolePermissionService>();
        services.AddScoped<ICustomerRepository, CustomerRepository>();
        services.AddScoped<IMeasurementRepository, MeasurementRepository>();
        services.AddScoped<IEmployeeRepository, EmployeeRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IOrderNumberGenerator, OrderNumberGenerator>();
        services.AddScoped<IInvoiceRepository, InvoiceRepository>();
        services.AddScoped<IInvoiceNumberGenerator, InvoiceNumberGenerator>();
        // Singleton: it holds a key derived once from configuration and is otherwise stateless.
        services.AddSingleton<IInvoiceShareTokenService, InvoiceShareTokenService>();
        services.AddScoped<IWhatsAppMessageRepository, WhatsAppMessageRepository>();
        services.AddScoped<ISettingRepository, SettingRepository>();
        services.AddScoped<IClothPriceRepository, ClothPriceRepository>();
        services.AddScoped<IClothReceiptRepository, ClothReceiptRepository>();
        services.AddScoped<IActivityLogRepository, ActivityLogRepository>();
        services.AddScoped<IReportRepository, ReportRepository>();
        services.AddScoped<IOccasionRepository, OccasionRepository>();
        services.AddScoped<IActiveSessionService, ActiveSessionService>();

        services.AddOptions<WhatsAppOptions>().Bind(configuration.GetSection(WhatsAppOptions.SectionName));

        services.AddHttpClient<IWhatsAppSender, MetaWhatsAppSender>((sp, client) =>
        {
            var whatsAppOptions = sp.GetRequiredService<IOptions<WhatsAppOptions>>().Value;
            client.BaseAddress = new Uri(whatsAppOptions.BaseUrl.TrimEnd('/') + "/");
        });

        return services;
    }
}
