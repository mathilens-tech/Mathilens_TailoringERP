using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace MathilensERP.IntegrationTests.Orders;

public class OrdersEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public OrdersEndpointsTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Create_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/orders", new { customerId = Guid.NewGuid(), dueAtUtc = DateTime.UtcNow, items = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithNoItems_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.PostAsJsonAsync(
            "/api/v1/orders", new { customerId = Guid.NewGuid(), dueAtUtc = DateTime.UtcNow, items = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Create_WithEmptyCustomerId_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.PostAsJsonAsync(
            "/api/v1/orders",
            new { customerId = Guid.Empty, dueAtUtc = DateTime.UtcNow, items = new[] { new { garmentType = "Shirt", quantity = 1, unitPrice = 100 } } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task GetById_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync($"/api/v1/orders/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task TransitionStatus_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.PutAsJsonAsync($"/api/v1/orders/{Guid.NewGuid()}/status", new { targetStatus = "InProgress" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Search_WithPageSizeAboveMaximum_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.GetAsync("/api/v1/orders?pageSize=1000");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    private void AuthenticateClient() =>
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestAuthentication.CreateBearerToken());
}
