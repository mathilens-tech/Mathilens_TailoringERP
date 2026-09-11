using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Billing;

/// <summary>
/// A single payment transaction against an <see cref="Invoice"/> (02_DATABASE.md § 10.10) —
/// supports partial and multiple payments against one invoice. Only ever created through
/// <see cref="Invoice.RecordPayment"/>, never independently, and never edited after creation:
/// a correction is a new, offsetting transaction, never a mutation of this record.
/// </summary>
public sealed class Payment : IAuditable
{
    public Guid Id { get; private set; }

    public Guid InvoiceId { get; private set; }

    public decimal Amount { get; private set; }

    public PaymentMethod Method { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public Guid CreatedBy { get; private set; }

    public DateTime? LastModifiedAtUtc { get; private set; }

    public Guid? LastModifiedBy { get; private set; }

    private Payment()
    {
        // Reserved for EF Core materialization.
    }

    internal static Payment Create(Guid invoiceId, decimal amount, PaymentMethod method)
    {
        return new Payment
        {
            Id = Guid.NewGuid(),
            InvoiceId = Guard.AgainstEmpty(invoiceId, nameof(invoiceId)),
            Amount = Guard.AgainstNegativeOrZero(amount, nameof(amount)),
            Method = method,
        };
    }

    public void SetCreationAudit(Guid createdBy, DateTime createdAtUtc)
    {
        CreatedBy = Guard.AgainstEmpty(createdBy, nameof(createdBy));
        CreatedAtUtc = createdAtUtc;
    }

    /// <summary>Never invoked in practice — a <see cref="Payment"/> row is insert-only (02_DATABASE.md § 10.10 Retention Rules).</summary>
    public void SetModificationAudit(Guid modifiedBy, DateTime modifiedAtUtc)
    {
        LastModifiedBy = Guard.AgainstEmpty(modifiedBy, nameof(modifiedBy));
        LastModifiedAtUtc = modifiedAtUtc;
    }
}
