using MathilensERP.Domain.Billing;

namespace MathilensERP.Application.Billing;

public sealed record InvoiceDto(
    Guid Id,
    /// <summary>The shop's own reference — "INV-2026-0001". Empty only on an invoice raised before numbering existed.</summary>
    string InvoiceNumber,
    Guid OrderId,
    Guid CustomerId,
    decimal Subtotal,
    decimal TaxAmount,
    decimal DiscountAmount,
    decimal TotalAmount,
    decimal AmountPaid,
    decimal RemainingBalance,
    InvoiceStatus Status,
    DateTime CreatedAtUtc,
    IReadOnlyList<PaymentDto> Payments);

public sealed record PaymentDto(Guid Id, decimal Amount, PaymentMethod Method, DateTime CreatedAtUtc);
