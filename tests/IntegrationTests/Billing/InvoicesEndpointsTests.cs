using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace MathilensERP.IntegrationTests.Billing;

public class InvoicesEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public InvoicesEndpointsTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Create_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/invoices", new { orderId = Guid.NewGuid(), taxAmount = 0, discountAmount = 0 });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithEmptyOrderId_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.PostAsJsonAsync("/api/v1/invoices", new { orderId = Guid.Empty, taxAmount = 0, discountAmount = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Create_WithNegativeTax_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.PostAsJsonAsync("/api/v1/invoices", new { orderId = Guid.NewGuid(), taxAmount = -1, discountAmount = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task GetById_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync($"/api/v1/invoices/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RecordPayment_WithNonPositiveAmount_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.PostAsJsonAsync($"/api/v1/invoices/{Guid.NewGuid()}/payments", new { amount = 0, method = "Cash" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Search_WithPageSizeAboveMaximum_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.GetAsync("/api/v1/invoices?pageSize=1000");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    private void AuthenticateClient() =>
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestAuthentication.CreateBearerToken());
}
