using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Orders;

/// <summary>
/// An order somebody started writing and has not finished.
///
/// <para>A table of its own rather than an <see cref="OrderStatus"/> before Received, and that is
/// the whole design decision. A draft is not an order that happens to be early — it is a form in
/// progress. Modelling it as an order would give it an order number it might never use, admit it to
/// every revenue, outstanding-balance and status-count query that filters on status, and force
/// order creation to accept records missing the fields it exists to require. None of that is true
/// of a row in this table, which nothing else joins to.</para>
///
/// <para>The contents are the form's own JSON, not columns. What a half-written order holds is
/// exactly the shape of the screen that writes it — customer, kind, item rows, dates, advance,
/// notes — and that shape changes whenever the screen does. Columns here would mean a migration
/// every time a field was added to New Order, and a draft saved before it silently losing that
/// field on resume. Nothing queries inside a draft: it is written whole and read whole, by the one
/// screen that understands it. <see cref="CustomerId"/> and <see cref="Kind"/> are lifted out only
/// because the list of drafts has to be readable without parsing every payload.</para>
/// </summary>
public sealed class OrderDraft : IAuditable
{
    public Guid Id { get; private set; }

    /// <summary>
    /// Whose draft this is.
    ///
    /// <para>Drafts are listed to the person who started one rather than to the whole shop. A
    /// half-typed order is working state, not a record: two staff at two counters would otherwise
    /// each see the other's abandoned attempts and have no way to tell them apart. The column is
    /// here rather than inferred from <see cref="IAuditable.CreatedBy"/> so that scoping the list
    /// is an explicit filter someone can read, and so a shop that decides drafts should be shared
    /// changes one query rather than the audit meaning.</para>
    /// </summary>
    public Guid OwnerUserId { get; private set; }

    /// <summary>Which of the three New Order screens wrote this, so resuming returns to the right one.</summary>
    public string Kind { get; private set; } = string.Empty;

    /// <summary>
    /// The customer, when one has been chosen. Null is ordinary — a draft can exist before anybody
    /// has been picked. Deliberately not a foreign key: a draft must not stop a customer being
    /// deleted, and a draft naming a customer who has since gone is a draft to discard, not a
    /// referential integrity error to resolve at the counter.
    /// </summary>
    public Guid? CustomerId { get; private set; }

    /// <summary>What the list shows, so a draft can be recognised without opening it.</summary>
    public string Summary { get; private set; } = string.Empty;

    /// <summary>The form's state, as JSON. Opaque here; only the New Order screen reads it.</summary>
    public string Payload { get; private set; } = string.Empty;

    public DateTime CreatedAtUtc { get; private set; }

    public Guid CreatedBy { get; private set; }

    public DateTime? LastModifiedAtUtc { get; private set; }

    public Guid? LastModifiedBy { get; private set; }

    private OrderDraft()
    {
        // Reserved for EF Core materialization.
    }

    public static OrderDraft Create(Guid ownerUserId, string kind, Guid? customerId, string summary, string payload)
    {
        return new OrderDraft
        {
            Id = Guid.NewGuid(),
            OwnerUserId = Guard.AgainstEmpty(ownerUserId, nameof(ownerUserId)),
            Kind = Guard.AgainstNullOrWhiteSpace(kind, nameof(kind)),
            CustomerId = customerId,
            Summary = summary ?? string.Empty,
            Payload = Guard.AgainstNullOrWhiteSpace(payload, nameof(payload)),
        };
    }

    /// <summary>
    /// Replaces the contents wholesale, which is what autosave does every few seconds.
    ///
    /// <para>The owner is never reassigned. A draft belongs to whoever started it for its whole
    /// life; if that could change on save, a second person opening a shared screen would take
    /// ownership of somebody else's unfinished work without either of them acting.</para>
    /// </summary>
    public void Replace(string kind, Guid? customerId, string summary, string payload)
    {
        Kind = Guard.AgainstNullOrWhiteSpace(kind, nameof(kind));
        CustomerId = customerId;
        Summary = summary ?? string.Empty;
        Payload = Guard.AgainstNullOrWhiteSpace(payload, nameof(payload));
    }

    public void SetCreationAudit(Guid createdBy, DateTime createdAtUtc)
    {
        CreatedBy = Guard.AgainstEmpty(createdBy, nameof(createdBy));
        CreatedAtUtc = createdAtUtc;
    }

    public void SetModificationAudit(Guid modifiedBy, DateTime modifiedAtUtc)
    {
        LastModifiedBy = Guard.AgainstEmpty(modifiedBy, nameof(modifiedBy));
        LastModifiedAtUtc = modifiedAtUtc;
    }
}
