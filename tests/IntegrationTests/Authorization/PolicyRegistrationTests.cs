using System.Reflection;
using MathilensERP.Shared.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.IntegrationTests.Authorization;

/// <summary>
/// Every policy an endpoint demands must be one the startup actually registered.
///
/// Program.cs registers one policy per entry in <see cref="Permissions.All"/>, and nothing checks
/// the two agree: a controller can name a policy that was never registered and the project still
/// compiles, because the attribute takes a string. The failure surfaces as a 500 on that endpoint
/// the first time somebody calls it in production — which is exactly the kind of thing that gets
/// noticed by a customer rather than by a build.
///
/// Reflection over the Api assembly rather than a booted host, so it needs no database and runs in
/// milliseconds — the point is to be cheap enough that nobody is tempted to skip it.
/// </summary>
public class PolicyRegistrationTests
{
    [Fact]
    public void EveryEndpointPolicy_IsRegisteredAtStartup()
    {
        var controllers = typeof(Program).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract);

        var demanded = controllers
            .SelectMany(controller => controller
                .GetCustomAttributes<AuthorizeAttribute>(inherit: true)
                .Concat(controller
                    .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                    .SelectMany(method => method.GetCustomAttributes<AuthorizeAttribute>(inherit: true))))
            .Select(attribute => attribute.Policy)
            .Where(policy => !string.IsNullOrWhiteSpace(policy))
            .Select(policy => policy!)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        Assert.NotEmpty(demanded);

        var unregistered = demanded.Where(policy => !Permissions.All.Contains(policy, StringComparer.Ordinal)).ToList();

        Assert.True(
            unregistered.Count == 0,
            $"These endpoints demand a policy that Permissions.All never registers: {string.Join(", ", unregistered)}.");
    }

    [Fact]
    public void NoEndpointDemandsAManageUmbrella()
    {
        // Manage is what a role is granted, never what an endpoint asks for. It expands to the
        // individual actions, so an endpoint demanding it would be unreachable for any role given
        // its actions one box at a time on the User Rights screen — which is now every role.
        var demanded = typeof(Program).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
            .SelectMany(controller => controller
                .GetCustomAttributes<AuthorizeAttribute>(inherit: true)
                .Concat(controller
                    .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                    .SelectMany(method => method.GetCustomAttributes<AuthorizeAttribute>(inherit: true))))
            .Select(attribute => attribute.Policy)
            .Where(policy => policy is not null)
            .ToList();

        Assert.DoesNotContain(demanded, policy => policy!.EndsWith($".{Permissions.Manage}", StringComparison.Ordinal));
    }
}
