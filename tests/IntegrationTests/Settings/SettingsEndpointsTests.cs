using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace MathilensERP.IntegrationTests.Settings;

public class SettingsEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public SettingsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Upsert_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.PutAsJsonAsync("/api/v1/settings/Shop.BusinessName", new { value = "Mathilens Tailoring" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Upsert_WithNullValue_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.PutAsJsonAsync("/api/v1/settings/Shop.BusinessName", new { value = (string?)null });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task GetByKey_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/v1/settings/Shop.BusinessName");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task List_WithPageSizeAboveMaximum_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.GetAsync("/api/v1/settings?pageSize=1000");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Delete_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.DeleteAsync("/api/v1/settings/Shop.BusinessName");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private void AuthenticateClient() =>
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestAuthentication.CreateBearerToken());
}
