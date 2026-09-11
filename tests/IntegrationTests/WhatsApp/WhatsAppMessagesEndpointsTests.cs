using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace MathilensERP.IntegrationTests.WhatsApp;

public class WhatsAppMessagesEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public WhatsAppMessagesEndpointsTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Send_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/v1/whatsapp-messages", new { customerId = Guid.NewGuid(), messageType = "Custom", content = "Hi" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Send_WithBlankContent_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.PostAsJsonAsync(
            "/api/v1/whatsapp-messages", new { customerId = Guid.NewGuid(), messageType = "Custom", content = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Send_WithEmptyCustomerId_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.PostAsJsonAsync(
            "/api/v1/whatsapp-messages", new { customerId = Guid.Empty, messageType = "Custom", content = "Hi" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task GetById_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync($"/api/v1/whatsapp-messages/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Search_WithPageSizeAboveMaximum_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.GetAsync("/api/v1/whatsapp-messages?pageSize=1000");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    private void AuthenticateClient() =>
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestAuthentication.CreateBearerToken());
}
