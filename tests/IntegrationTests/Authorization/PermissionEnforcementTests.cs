using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using MathilensERP.Shared.Authorization;

namespace MathilensERP.IntegrationTests.Authorization;

/// <summary>
/// Proves the permission gate is real. Hiding a button in the UI is a courtesy; these assert that
/// the server refuses the request regardless of what the client chose to show.
/// </summary>
public class PermissionEnforcementTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public PermissionEnforcementTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private HttpClient ClientAs(string role)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestAuthentication.CreateBearerToken(role: role));
        return client;
    }

    [Fact]
    public async Task Tailor_CannotReachTheActivityLog()
    {
        var response = await ClientAs(AppRoles.Tailor).GetAsync("/api/v1/activity-logs");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Tailor_CannotCreateACustomer()
    {
        // A tailor may see customers, but not change them.
        var response = await ClientAs(AppRoles.Tailor).PostAsJsonAsync(
            "/api/v1/customers", new { fullName = "Asha Rao", phoneNumber = "+91 98765 43210" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task FrontDesk_CannotManageUsers()
    {
        var response = await ClientAs(AppRoles.FrontDesk).PostAsJsonAsync(
            "/api/v1/users", new { email = "new@shop.example", password = "Passw0rd!", role = AppRoles.Tailor });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task FrontDesk_CannotReadTheEmployeeList()
    {
        var response = await ClientAs(AppRoles.FrontDesk).GetAsync("/api/v1/employees");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Manager_CanReachOperationalScreens()
    {
        // Not Forbidden is the assertion — reaching the handler and failing on the absent test
        // database is fine here, since only the permission gate is under test.
        var response = await ClientAs(AppRoles.Manager).GetAsync("/api/v1/employees");

        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UnknownRole_GrantsNothing()
    {
        // A stale role claim in an old token must fail closed rather than crash or let anything through.
        var response = await ClientAs("Intern").GetAsync("/api/v1/customers");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
