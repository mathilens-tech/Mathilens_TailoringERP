using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.WhatsApp.Commands.RecordShare;

/// <summary>
/// Notes that staff opened WhatsApp to share an invoice. Not that anything was sent.
///
/// <para>The shop hands the message to WhatsApp with the text filled in; whether the Send button
/// was then pressed happens in another application, on another company's servers, and this one has
/// no way to find out. So the trail says what is actually known — a share was started, by whom, for
/// which order — and never claims delivery. Reading "WhatsApp Sent" against a message that was
/// never sent is worse than having no record at all.</para>
///
/// <para>It writes nothing itself. Being a command is the whole point: ActivityLogBehavior records
/// every successful one, so this earns its row in the Activity Log for free and gains whatever that
/// screen learns to show next.</para>
/// </summary>
public sealed record RecordWhatsAppShareCommand(
    Guid CustomerId,
    string OrderNumber,
    string InvoiceNumber) : ICommand<Result>;

public sealed class RecordWhatsAppShareCommandHandler : ICommandHandler<RecordWhatsAppShareCommand, Result>
{
    private readonly ICustomerRepository _customerRepository;

    public RecordWhatsAppShareCommandHandler(ICustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }

    public async Task<Result> Handle(RecordWhatsAppShareCommand command, CancellationToken cancellationToken)
    {
        // The customer is checked rather than taken on trust: a row in the trail naming a customer
        // who does not exist is a row that cannot be followed up, and the failure result keeps the
        // behavior from logging it.
        var customer = await _customerRepository.GetByIdAsync(command.CustomerId, cancellationToken);
        if (customer is null)
        {
            return Result.Failure(
                Error.NotFound("Customer.NotFound", $"No customer was found with id '{command.CustomerId}'."));
        }

        return Result.Success();
    }
}
