using System.Net.Http.Headers;
using System.Net.Http.Json;
using MathilensERP.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MathilensERP.Infrastructure.WhatsApp;

/// <summary>
/// Sends outbound messages via Meta's WhatsApp Cloud API (the official WhatsApp Business
/// Platform, called directly — no intermediary like Twilio), per the user's explicit choice.
///
/// <b>Unverified against a live account</b>: no real Meta Business/WhatsApp Business Account
/// credentials have been available in this development environment, so this client has never
/// actually sent a message — only been written to match Meta's documented Cloud API contract
/// (`POST /{api-version}/{phone-number-id}/messages`). Treat it the same as every EF Core
/// migration in this project: syntactically/structurally correct, not yet round-tripped
/// against the real thing.
/// </summary>
public sealed class MetaWhatsAppSender : IWhatsAppSender
{
    private readonly HttpClient _httpClient;
    private readonly WhatsAppOptions _options;
    private readonly ILogger<MetaWhatsAppSender> _logger;

    public MetaWhatsAppSender(HttpClient httpClient, IOptions<WhatsAppOptions> options, ILogger<MetaWhatsAppSender> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<WhatsAppSendResult> SendTextMessageAsync(string toPhoneNumber, string message, CancellationToken cancellationToken)
    {
        if (!_options.IsConfigured)
        {
            return WhatsAppSendResult.Failed("WhatsApp integration is not configured (missing AccessToken/PhoneNumberId).");
        }

        var payload = new
        {
            messaging_product = "whatsapp",
            to = NormalizePhoneNumber(toPhoneNumber),
            type = "text",
            text = new { body = message },
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.ApiVersion}/{_options.PhoneNumberId}/messages")
        {
            Content = JsonContent.Create(payload),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.AccessToken);

        try
        {
            using var response = await _httpClient.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadFromJsonAsync<MetaSendResponse>(cancellationToken: cancellationToken);

            if (response.IsSuccessStatusCode && body?.Messages is { Length: > 0 })
            {
                return WhatsAppSendResult.Succeeded(body.Messages[0].Id);
            }

            var errorMessage = body?.Error?.Message ?? $"WhatsApp API returned HTTP {(int)response.StatusCode}.";
            _logger.LogWarning("WhatsApp send failed: {Error}", errorMessage);
            return WhatsAppSendResult.Failed(errorMessage);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // A third-party API's transient/network failure is an expected outcome at this
            // boundary, not a programming error — caught and reported as a Result, matching
            // 01_ARCHITECTURE.md § 13 Exception Strategy's "expected outcomes are never
            // exceptions" for everywhere else this product models business outcomes.
            _logger.LogError(ex, "WhatsApp send threw while calling the provider");
            return WhatsAppSendResult.Failed($"Failed to reach the WhatsApp API: {ex.Message}");
        }
    }

    private static string NormalizePhoneNumber(string phoneNumber) =>
        new([.. phoneNumber.Where(c => char.IsDigit(c) || c == '+')]);

    private sealed record MetaSendResponse(MetaMessage[]? Messages, MetaError? Error);

    private sealed record MetaMessage(string Id);

    private sealed record MetaError(string Message);
}
