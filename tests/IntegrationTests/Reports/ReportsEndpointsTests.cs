using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace MathilensERP.IntegrationTests.Reports;

public class ReportsEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ReportsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Revenue_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/v1/reports/revenue?fromUtc=2026-01-01&toUtc=2026-01-31");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Revenue_WithToBeforeFrom_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.GetAsync("/api/v1/reports/revenue?fromUtc=2026-01-31&toUtc=2026-01-01");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task OrderCollections_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/v1/reports/order-collections?fromUtc=2026-01-01&toUtc=2026-01-31");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task OrderCollections_WithToBeforeFrom_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.GetAsync("/api/v1/reports/order-collections?fromUtc=2026-01-31&toUtc=2026-01-01");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task OrderStatusSummary_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/v1/reports/order-status-summary?fromUtc=2026-01-01&toUtc=2026-01-31");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task OrderStatusSummary_WithToBeforeFrom_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.GetAsync("/api/v1/reports/order-status-summary?fromUtc=2026-01-31&toUtc=2026-01-01");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task OutstandingInvoices_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/v1/reports/outstanding-invoices");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task OutstandingInvoices_WithPageSizeAboveMaximum_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.GetAsync("/api/v1/reports/outstanding-invoices?pageSize=1000");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    private void AuthenticateClient() =>
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestAuthentication.CreateBearerToken());
}
