using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Billing.Commands.Create;

public sealed record CreateInvoiceCommand(Guid OrderId, decimal TaxAmount, decimal DiscountAmount) : ICommand<Result<InvoiceDto>>;
