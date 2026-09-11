namespace MathilensERP.Api.Contracts.Billing;

public sealed record CreateInvoiceRequest(Guid OrderId, decimal TaxAmount, decimal DiscountAmount);
