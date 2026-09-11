using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Billing.Commands.RecordPayment;

public sealed class RecordPaymentCommandHandler : ICommandHandler<RecordPaymentCommand, Result<InvoiceDto>>
{
    private readonly IInvoiceRepository _invoiceRepository;

    public RecordPaymentCommandHandler(IInvoiceRepository invoiceRepository)
    {
        _invoiceRepository = invoiceRepository;
    }

    public async Task<Result<InvoiceDto>> Handle(RecordPaymentCommand command, CancellationToken cancellationToken)
    {
        var invoice = await _invoiceRepository.GetByIdAsync(command.InvoiceId, cancellationToken);
        if (invoice is null)
        {
            return Result.Failure<InvoiceDto>(Error.NotFound("Invoice.NotFound", $"No invoice was found with id '{command.InvoiceId}'."));
        }

        if (!invoice.CanAcceptPayment(command.Amount))
        {
            return Result.Failure<InvoiceDto>(Error.Conflict(
                "Invoice.PaymentNotAcceptable",
                $"A payment of {command.Amount} cannot be applied to this invoice (status '{invoice.Status}', remaining balance {invoice.RemainingBalance})."));
        }

        invoice.RecordPayment(command.Amount, command.Method);
        await _invoiceRepository.SaveChangesAsync(cancellationToken);

        return invoice.ToDto();
    }
}
