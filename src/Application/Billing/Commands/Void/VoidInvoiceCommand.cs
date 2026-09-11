using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Billing.Commands.Void;

public sealed record VoidInvoiceCommand(Guid InvoiceId) : ICommand<Result>;
