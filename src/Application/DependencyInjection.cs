using System.Reflection;
using FluentValidation;
using MathilensERP.Application.Common.Behaviors;
using MathilensERP.Application.Common.Mediator;
using Microsoft.Extensions.DependencyInjection;

namespace MathilensERP.Application;

/// <summary>
/// Application's half of the composition root (01_ARCHITECTURE.md § 10) — called once from
/// Api's <c>Program.cs</c>. Scans this assembly for command/query handlers and validators
/// so a new module's handler is wired up automatically just by existing, with nothing to
/// remember to register by hand (00_MASTER_SPEC.md § 16.2).
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = typeof(DependencyInjection).Assembly;

        services.AddScoped<ISender, Sender>();

        RegisterOpenGenericImplementations(services, assembly, typeof(ICommandHandler<,>));
        RegisterOpenGenericImplementations(services, assembly, typeof(IQueryHandler<,>));
        RegisterOpenGenericImplementations(services, assembly, typeof(IValidator<>));

        // Order matters: validation runs first, so a rejected command never reaches the handler and
        // never reaches the activity trail either — the trail records what happened, not what was
        // attempted and refused.
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ActivityLogBehavior<,>));

        return services;
    }

    /// <summary>
    /// Finds every concrete class in <paramref name="assembly"/> implementing a closed form of
    /// <paramref name="openInterface"/> and registers it against that closed interface.
    /// </summary>
    private static void RegisterOpenGenericImplementations(IServiceCollection services, Assembly assembly, Type openInterface)
    {
        var registrations = assembly.GetTypes()
            .Where(type => type is { IsClass: true, IsAbstract: false })
            .SelectMany(type => type.GetInterfaces()
                .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == openInterface)
                .Select(closedInterface => (Interface: closedInterface, Implementation: type)));

        foreach (var (closedInterface, implementation) in registrations)
        {
            services.AddScoped(closedInterface, implementation);
        }
    }
}
