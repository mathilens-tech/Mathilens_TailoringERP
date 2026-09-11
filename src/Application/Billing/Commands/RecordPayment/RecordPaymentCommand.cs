using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Billing;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Billing.Commands.RecordPayment;

public sealed record RecordPaymentCommand(Guid InvoiceId, decimal Amount, PaymentMethod Method) : ICommand<Result<InvoiceDto>>;
