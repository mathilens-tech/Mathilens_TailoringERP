using System.Security.Cryptography;
using System.Text;
using MathilensERP.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace MathilensERP.Infrastructure.Billing;

/// <summary>
/// The share token: an invoice id encrypted with AES-GCM and rendered base64url.
///
/// <para>Encrypted rather than signed, so the id is not merely unforgeable but absent — a signed
/// token would carry the GUID in plain sight, and 15 § Security asks that internal identifiers stay
/// internal. AES-GCM authenticates as well as encrypts, so a token that has been edited by a single
/// character fails to open rather than opening onto the wrong invoice.</para>
///
/// <para>No expiry is built in. A customer keeps the bill for the garment, and a link that stops
/// working a week later is a support call; revocation, if it is ever wanted, is a key rotation.</para>
/// </summary>
public sealed class InvoiceShareTokenService : IInvoiceShareTokenService
{
    private const int NonceBytes = 12;
    private const int TagBytes = 16;
    private const int GuidBytes = 16;

    /// <summary>
    /// Separates this key's purpose from the signing key it may be derived from, so a token can
    /// never be mistaken for — or forged from — an access token.
    /// </summary>
    private const string KeyPurpose = "MathilensERP.InvoiceShareToken.v1";

    private readonly byte[] _key;

    public InvoiceShareTokenService(IConfiguration configuration)
    {
        // A key of its own when one is configured. Otherwise derived from the JWT signing key,
        // which every environment already has — the alternative is a feature that works locally and
        // silently 404s in production because nobody added a second secret. Hashed with a purpose
        // string rather than used directly, so the two keys are unrelated in practice.
        var configured = configuration["InvoiceSharing:Key"];
        _key = string.IsNullOrWhiteSpace(configured)
            ? SHA256.HashData(Encoding.UTF8.GetBytes(KeyPurpose + "|" + configuration["Jwt:SigningKey"]))
            : SHA256.HashData(Encoding.UTF8.GetBytes(KeyPurpose + "|" + configured));
    }

    public string Create(Guid invoiceId)
    {
        var nonce = RandomNumberGenerator.GetBytes(NonceBytes);
        var plaintext = invoiceId.ToByteArray();
        var ciphertext = new byte[GuidBytes];
        var tag = new byte[TagBytes];

        using var aes = new AesGcm(_key, TagBytes);
        aes.Encrypt(nonce, plaintext, ciphertext, tag);

        var token = new byte[NonceBytes + GuidBytes + TagBytes];
        nonce.CopyTo(token, 0);
        ciphertext.CopyTo(token, NonceBytes);
        tag.CopyTo(token, NonceBytes + GuidBytes);

        // base64url: the token travels in a path segment and then through a WhatsApp message, where
        // '+' and '/' would be mangled by one and made unclickable by the other.
        return Base64UrlEncode(token);
    }

    public bool TryRead(string token, out Guid invoiceId)
    {
        invoiceId = Guid.Empty;

        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        byte[] raw;
        try
        {
            raw = Base64UrlDecode(token);
        }
        catch (FormatException)
        {
            return false;
        }

        if (raw.Length != NonceBytes + GuidBytes + TagBytes)
        {
            return false;
        }

        var plaintext = new byte[GuidBytes];
        try
        {
            using var aes = new AesGcm(_key, TagBytes);
            aes.Decrypt(
                raw.AsSpan(0, NonceBytes),
                raw.AsSpan(NonceBytes, GuidBytes),
                raw.AsSpan(NonceBytes + GuidBytes, TagBytes),
                plaintext);
        }
        catch (CryptographicException)
        {
            // The one thing a caller may learn is that this token is not ours. Which of the checks
            // it failed is not something an anonymous endpoint should be helping anyone work out.
            return false;
        }

        invoiceId = new Guid(plaintext);
        return true;
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '='));
    }
}
