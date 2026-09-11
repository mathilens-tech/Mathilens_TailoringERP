using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace MathilensERP.IntegrationTests.Measurements;

public class MeasurementsEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public MeasurementsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Create_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/v1/customers/{Guid.NewGuid()}/measurements", new { garmentType = "Shirt", values = new { Chest = 40 } });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithNoValues_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.PostAsJsonAsync(
            $"/api/v1/customers/{Guid.NewGuid()}/measurements", new { garmentType = "Shirt", values = new Dictionary<string, decimal>() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Create_WithNonPositiveValue_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.PostAsJsonAsync(
            $"/api/v1/customers/{Guid.NewGuid()}/measurements", new { garmentType = "Shirt", values = new Dictionary<string, decimal> { ["Chest"] = 0 } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Create_WithValidStringGarmentTypeAndValues_PassesValidationAndReachesTheHandler()
    {
        // Proves string actually deserializes from its JSON string name ("Shirt"), not
        // just that malformed requests get rejected — a request that's fully valid gets past
        // both model binding and FluentValidation into CreateMeasurementCommandHandler. Without
        // a JsonStringEnumConverter registered, "Shirt" wouldn't bind to string at all and
        // this would come back 400, for the wrong reason.
        //
        // What happens *after* validation depends on the machine: 500 where no PostgreSQL is
        // listening on localhost (CI), 404 "no such customer" where one is (a dev box). Asserting
        // the 500 made this test pass or fail on that accident rather than on the binding it
        // exists to prove, so it asserts only what it can actually claim.
        AuthenticateClient();

        var response = await _client.PostAsJsonAsync(
            $"/api/v1/customers/{Guid.NewGuid()}/measurements", new { garmentType = "Shirt", values = new Dictionary<string, decimal> { ["Chest"] = 40 } });

        Assert.NotEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetById_WithoutBearerToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync($"/api/v1/measurements/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetHistory_WithPageSizeAboveMaximum_ReturnsValidationErrorEnvelope()
    {
        AuthenticateClient();

        var response = await _client.GetAsync($"/api/v1/measurements/{Guid.NewGuid()}/history?pageSize=1000");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetProperty("code").GetString());
    }

    private void AuthenticateClient() =>
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestAuthentication.CreateBearerToken());
}
