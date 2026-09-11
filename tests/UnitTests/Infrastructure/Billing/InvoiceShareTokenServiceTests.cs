using MathilensERP.Infrastructure.Billing;
using Microsoft.Extensions.Configuration;

namespace MathilensERP.UnitTests.Infrastructure.Billing;

/// <summary>
/// The share token is the whole of the authorisation on the one anonymous endpoint this API has, so
/// what it refuses matters as much as what it accepts.
/// </summary>
public class InvoiceShareTokenServiceTests
{
    private static InvoiceShareTokenService Service(string signingKey = "test-signing-key") =>
        new(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:SigningKey"] = signingKey })
            .Build());

    [Fact]
    public void Reads_back_the_invoice_it_was_created_for()
    {
        var service = Service();
        var invoiceId = Guid.NewGuid();

        Assert.True(service.TryRead(service.Create(invoiceId), out var read));
        Assert.Equal(invoiceId, read);
    }

    [Fact]
    public void Does_not_repeat_itself_for_the_same_invoice()
    {
        // Each token carries its own nonce, so two links for one invoice do not look alike. A token
        // that was a pure function of the id would let anyone holding two of them confirm that a
        // third belonged to the same invoice.
        var service = Service();
        var invoiceId = Guid.NewGuid();

        Assert.NotEqual(service.Create(invoiceId), service.Create(invoiceId));
    }

    [Fact]
    public void Does_not_carry_the_invoice_id_in_the_clear()
    {
        var service = Service();
        var invoiceId = Guid.NewGuid();
        var token = service.Create(invoiceId);

        Assert.DoesNotContain(invoiceId.ToString("N"), token, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(invoiceId.ToString("D"), token, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-a-token")]
    [InlineData("!!!not base64 at all!!!")]
    public void Refuses_anything_it_did_not_issue(string token)
    {
        Assert.False(Service().TryRead(token, out _));
    }

    [Fact]
    public void Refuses_a_token_that_has_been_edited()
    {
        var service = Service();
        var token = service.Create(Guid.NewGuid()).ToCharArray();

        // One character of the ciphertext, flipped. AES-GCM authenticates as well as encrypts, so
        // this must fail to open rather than opening onto some other invoice.
        token[^3] = token[^3] == 'A' ? 'B' : 'A';

        Assert.False(service.TryRead(new string(token), out _));
    }

    [Fact]
    public void Refuses_a_token_issued_under_a_different_key()
    {
        var token = Service("one-key").Create(Guid.NewGuid());

        // What makes rotating the key a revocation, and what stops a token minted against a dev
        // environment from opening anything in production.
        Assert.False(Service("another-key").TryRead(token, out _));
    }
}
