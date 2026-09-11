namespace MathilensERP.Application.Common.Interfaces;

/// <summary>
/// Turns an invoice into an opaque token a customer can be handed, and back again.
///
/// <para>A port rather than a static helper because the implementation holds a key: the token is
/// the only thing standing between a link and somebody else's invoice, so it is produced and read
/// in one place that Infrastructure owns and no handler can shortcut.</para>
///
/// <para>Deliberately stateless. Storing a token per invoice would mean a column, a migration and a
/// backfill before any invoice raised before today could be shared; a token that carries its own
/// (encrypted) subject needs none of that and works for every invoice already in the books.</para>
/// </summary>
public interface IInvoiceShareTokenService
{
    /// <summary>The token for an invoice. Not stable between calls — each carries its own nonce.</summary>
    string Create(Guid invoiceId);

    /// <summary>
    /// The invoice a token refers to, or <c>false</c> for anything this service did not issue —
    /// a token that was edited, truncated, guessed, or signed with a different key.
    /// </summary>
    bool TryRead(string token, out Guid invoiceId);
}
