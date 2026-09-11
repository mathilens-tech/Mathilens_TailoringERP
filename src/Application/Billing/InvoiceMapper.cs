using MathilensERP.Domain.Billing;

namespace MathilensERP.Application.Billing;

internal static class InvoiceMapper
{
    public static InvoiceDto ToDto(this Invoice invoice) =>
        new(
            invoice.Id,
            invoice.InvoiceNumber,
            invoice.OrderId,
            invoice.CustomerId,
            invoice.Subtotal,
            invoice.TaxAmount,
            invoice.DiscountAmount,
            invoice.TotalAmount,
            invoice.AmountPaid,
            invoice.RemainingBalance,
            invoice.Status,
            invoice.CreatedAtUtc,
            invoice.Payments.Select(p => p.ToDto()).ToList());

    private static PaymentDto ToDto(this Payment payment) =>
        new(payment.Id, payment.Amount, payment.Method, payment.CreatedAtUtc);
}
