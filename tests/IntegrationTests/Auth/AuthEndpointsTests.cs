using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace MathilensERP.IntegrationTests.Auth;

public class AuthEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AuthEndpointsTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Login_WithBlankCredentials_ReturnsValidationErrorEnvelope()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { userName = "", password = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
        Assert.True(body.GetProperty("error").GetProperty("details").GetArrayLength() > 0);
    }

    [Fact]
    public async Task Login_WithTooShortUserName_ReturnsValidationErrorEnvelope()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/v1/auth/login", new { userName = "asha", password = "somepassword" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Refresh_WithBlankToken_ReturnsValidationErrorEnvelope()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }
}
