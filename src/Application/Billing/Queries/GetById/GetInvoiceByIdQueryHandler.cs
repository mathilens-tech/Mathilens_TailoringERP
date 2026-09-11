using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Billing.Queries.GetById;

public sealed class GetInvoiceByIdQueryHandler : IQueryHandler<GetInvoiceByIdQuery, Result<InvoiceDto>>
{
    private readonly IInvoiceRepository _invoiceRepository;

    public GetInvoiceByIdQueryHandler(IInvoiceRepository invoiceRepository)
    {
        _invoiceRepository = invoiceRepository;
    }

    public async Task<Result<InvoiceDto>> Handle(GetInvoiceByIdQuery query, CancellationToken cancellationToken)
    {
        var invoice = await _invoiceRepository.GetByIdAsync(query.Id, cancellationToken);

        return invoice is null
            ? Result.Failure<InvoiceDto>(Error.NotFound("Invoice.NotFound", $"No invoice was found with id '{query.Id}'."))
            : invoice.ToDto();
    }
}
