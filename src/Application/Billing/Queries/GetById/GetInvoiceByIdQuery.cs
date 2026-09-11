using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Billing.Queries.GetById;

public sealed record GetInvoiceByIdQuery(Guid Id) : IQuery<Result<InvoiceDto>>;
