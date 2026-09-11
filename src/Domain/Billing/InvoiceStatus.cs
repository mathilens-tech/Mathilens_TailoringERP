namespace MathilensERP.Domain.Billing;

/// <summary>An invoice's billing status (02_DATABASE.md § 10.9) — recomputed automatically by <see cref="Invoice.RecordPayment"/> as payments come in, not set directly.</summary>
public enum InvoiceStatus
{
    Unpaid,
    PartiallyPaid,
    Paid,
    Void
}
