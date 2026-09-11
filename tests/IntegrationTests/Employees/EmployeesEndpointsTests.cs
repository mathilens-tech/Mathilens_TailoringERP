using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace MathilensERP.IntegrationTests.Employees;

public class EmployeesEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public EmployeesEndpointsTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Create_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/employees", new { fullName = "Ravi Kumar" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithBlankFullName_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.PostAsJsonAsync("/api/v1/employees", new { fullName = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Create_WithMalformedEmail_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.PostAsJsonAsync("/api/v1/employees", new { fullName = "Ravi Kumar", email = "not-an-email" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task GetById_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync($"/api/v1/employees/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Search_WithPageBelowOne_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.GetAsync("/api/v1/employees?page=0");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    private void AuthenticateClient() =>
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestAuthentication.CreateBearerToken());
}
