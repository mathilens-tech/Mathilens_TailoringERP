namespace MathilensERP.Application.Common.Interfaces;

/// <summary>
/// Port for sending an outbound WhatsApp message, implemented in Infrastructure against a
/// specific provider (01_ARCHITECTURE.md § 25.5 Strategy / § 28 Risks — isolates the product
/// from that provider's outages or contract changes).
/// </summary>
public interface IWhatsAppSender
{
    Task<WhatsAppSendResult> SendTextMessageAsync(string toPhoneNumber, string message, CancellationToken cancellationToken);
}

public sealed record WhatsAppSendResult(bool Success, string? ProviderMessageId, string? ErrorMessage)
{
    public static WhatsAppSendResult Succeeded(string providerMessageId) => new(true, providerMessageId, null);

    public static WhatsAppSendResult Failed(string errorMessage) => new(false, null, errorMessage);
}
