using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Billing.Commands.Void;

public sealed class VoidInvoiceCommandHandler : ICommandHandler<VoidInvoiceCommand, Result>
{
    private readonly IInvoiceRepository _invoiceRepository;

    public VoidInvoiceCommandHandler(IInvoiceRepository invoiceRepository)
    {
        _invoiceRepository = invoiceRepository;
    }

    public async Task<Result> Handle(VoidInvoiceCommand command, CancellationToken cancellationToken)
    {
        var invoice = await _invoiceRepository.GetByIdAsync(command.InvoiceId, cancellationToken);
        if (invoice is null)
        {
            return Result.Failure(Error.NotFound("Invoice.NotFound", $"No invoice was found with id '{command.InvoiceId}'."));
        }

        if (!invoice.CanVoid)
        {
            return Result.Failure(Error.Conflict(
                "Invoice.CannotVoid", "Only an unpaid invoice with no recorded payments can be voided."));
        }

        invoice.Void();
        await _invoiceRepository.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
