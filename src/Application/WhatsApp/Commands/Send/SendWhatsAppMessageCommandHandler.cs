using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Orders;
using MathilensERP.Application.WhatsApp;
using MathilensERP.Domain.WhatsApp;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.WhatsApp.Commands.Send;

/// <summary>
/// Persists the message as <c>Pending</c> before attempting the send, and updates its status
/// afterward, as two separate commits rather than one transaction spanning the external HTTP
/// call — so a message is never lost from the log even if the provider call fails or hangs
/// (01_ARCHITECTURE.md § 11.5: "failures are logged and surfaced").
/// </summary>
public sealed class SendWhatsAppMessageCommandHandler : ICommandHandler<SendWhatsAppMessageCommand, Result<WhatsAppMessageDto>>
{
    private readonly IWhatsAppMessageRepository _messageRepository;
    private readonly ICustomerRepository _customerRepository;
    private readonly IOrderRepository _orderRepository;
    private readonly IWhatsAppSender _sender;

    public SendWhatsAppMessageCommandHandler(
        IWhatsAppMessageRepository messageRepository,
        ICustomerRepository customerRepository,
        IOrderRepository orderRepository,
        IWhatsAppSender sender)
    {
        _messageRepository = messageRepository;
        _customerRepository = customerRepository;
        _orderRepository = orderRepository;
        _sender = sender;
    }

    public async Task<Result<WhatsAppMessageDto>> Handle(SendWhatsAppMessageCommand command, CancellationToken cancellationToken)
    {
        var customer = await _customerRepository.GetByIdAsync(command.CustomerId, cancellationToken);
        if (customer is null)
        {
            return Result.Failure<WhatsAppMessageDto>(
                Error.NotFound("Customer.NotFound", $"No customer was found with id '{command.CustomerId}'."));
        }

        if (command.OrderId is { } orderId)
        {
            var order = await _orderRepository.GetByIdAsync(orderId, cancellationToken);
            if (order is null)
            {
                return Result.Failure<WhatsAppMessageDto>(Error.NotFound("Order.NotFound", $"No order was found with id '{orderId}'."));
            }
        }

        var message = WhatsAppMessage.Create(command.CustomerId, command.OrderId, command.MessageType, command.Content);
        _messageRepository.Add(message);
        await _messageRepository.SaveChangesAsync(cancellationToken);

        var sendResult = await _sender.SendTextMessageAsync(customer.PhoneNumber, command.Content, cancellationToken);

        if (sendResult.Success)
        {
            message.MarkSent(sendResult.ProviderMessageId!);
        }
        else
        {
            message.MarkFailed(sendResult.ErrorMessage!);
        }

        await _messageRepository.SaveChangesAsync(cancellationToken);

        return message.ToDto();
    }
}
