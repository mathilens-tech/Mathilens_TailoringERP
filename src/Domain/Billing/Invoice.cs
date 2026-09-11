using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Billing;

/// <summary>
/// A bill issued to a customer for an order (02_DATABASE.md § 10.9) — the aggregate root for
/// its <see cref="Payment"/>s, and the record they settle against.
///
/// <b>Design decision:</b> keeps the relationship to <c>Orders</c> as the doc's stated default
/// — many-to-one (an order may have more than one invoice over time; each invoice bills
/// exactly one order) — rather than building many-to-one-spanning-multiple-orders, which
/// 02_DATABASE.md § 10.9 explicitly frames as a decision this module makes, not a requirement.
/// </summary>
public sealed class Invoice : AuditableEntity
{
    private readonly List<Payment> _payments = [];

    /// <summary>
    /// The shop's own reference for this bill — "INV-2026-0001". What a customer quotes back, and
    /// what the shop looks it up by; the id is not something anyone can read off a printed slip.
    /// </summary>
    public string InvoiceNumber { get; private set; } = string.Empty;

    public Guid OrderId { get; private set; }

    public Guid CustomerId { get; private set; }

    public decimal Subtotal { get; private set; }

    public decimal TaxAmount { get; private set; }

    public decimal DiscountAmount { get; private set; }

    public decimal TotalAmount { get; private set; }

    public decimal AmountPaid { get; private set; }

    public InvoiceStatus Status { get; private set; }

    public IReadOnlyList<Payment> Payments => _payments;

    public decimal RemainingBalance => TotalAmount - AmountPaid;

    /// <summary>Only an unpaid invoice with no recorded payments can be voided — a partially/fully paid invoice needs the (future) credit/adjustment process, not a void.</summary>
    public bool CanVoid => AmountPaid == 0 && Status != InvoiceStatus.Void;

    private Invoice()
    {
        // Reserved for EF Core materialization.
    }

    private Invoice(Guid id)
        : base(id)
    {
    }

    /// <param name="invoiceNumber">
    /// Issued by <c>IInvoiceNumberGenerator</c>. Optional only so the existing tests, which care
    /// about totals and payments rather than references, need not supply one.
    /// </param>
    public static Invoice Create(
        Guid orderId,
        Guid customerId,
        decimal subtotal,
        decimal taxAmount,
        decimal discountAmount,
        string? invoiceNumber = null)
    {
        if (subtotal <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(subtotal), subtotal, "Subtotal must be greater than zero.");
        }

        if (taxAmount < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(taxAmount), taxAmount, "Tax amount cannot be negative.");
        }

        if (discountAmount < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(discountAmount), discountAmount, "Discount amount cannot be negative.");
        }

        var totalAmount = subtotal - discountAmount + taxAmount;
        if (totalAmount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(discountAmount), discountAmount, "The discount cannot bring the invoice total to zero or below.");
        }

        return new Invoice(Guid.NewGuid())
        {
            InvoiceNumber = invoiceNumber?.Trim() ?? string.Empty,
            OrderId = Guard.AgainstEmpty(orderId, nameof(orderId)),
            CustomerId = Guard.AgainstEmpty(customerId, nameof(customerId)),
            Subtotal = subtotal,
            TaxAmount = taxAmount,
            DiscountAmount = discountAmount,
            TotalAmount = totalAmount,
            Status = InvoiceStatus.Unpaid,
        };
    }

    /// <summary>Whether <paramref name="amount"/> can currently be applied as a payment. Callers should check this before calling <see cref="RecordPayment"/>.</summary>
    public bool CanAcceptPayment(decimal amount) =>
        Status != InvoiceStatus.Void && amount > 0 && amount <= RemainingBalance;

    /// <summary>Records a payment and recomputes <see cref="Status"/> — never overwrites a prior payment (02_DATABASE.md § 10.10).</summary>
    public Payment RecordPayment(decimal amount, PaymentMethod method)
    {
        if (!CanAcceptPayment(amount))
        {
            throw new InvalidOperationException(
                $"A payment of {amount} cannot be applied to this invoice (status '{Status}', remaining balance {RemainingBalance}).");
        }

        var payment = Payment.Create(Id, amount, method);
        _payments.Add(payment);

        AmountPaid += amount;
        Status = AmountPaid >= TotalAmount ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid;

        return payment;
    }

    public void Void()
    {
        if (!CanVoid)
        {
            throw new InvalidOperationException("Only an unpaid invoice with no recorded payments can be voided.");
        }

        Status = InvoiceStatus.Void;
    }
}
