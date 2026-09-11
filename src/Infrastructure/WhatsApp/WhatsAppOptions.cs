namespace MathilensERP.Infrastructure.WhatsApp;

/// <summary>
/// Bound from the "WhatsApp" configuration section. Deliberately not required-on-start
/// (unlike <c>JwtOptions</c>): WhatsApp is an optional integration, and the API must still
/// start cleanly in environments/tests where it isn't configured yet — <see cref="IsConfigured"/>
/// is checked per-send instead, per 00_MASTER_SPEC.md § 13.1 Environment Variables.
/// </summary>
public sealed class WhatsAppOptions
{
    public const string SectionName = "WhatsApp";

    /// <summary>Meta Graph API permanent/system-user access token for the WhatsApp Business Account.</summary>
    public string? AccessToken { get; init; }

    /// <summary>The WhatsApp Business phone number's Meta-assigned id (not the phone number itself).</summary>
    public string? PhoneNumberId { get; init; }

    public string ApiVersion { get; init; } = "v21.0";

    public string BaseUrl { get; init; } = "https://graph.facebook.com";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(AccessToken) && !string.IsNullOrWhiteSpace(PhoneNumberId);
}
