using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Orders;
using MathilensERP.Application.WhatsApp;
using MathilensERP.Application.WhatsApp.Commands.Send;
using MathilensERP.Domain.Customers;
using MathilensERP.Domain.Orders;
using MathilensERP.Domain.WhatsApp;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.WhatsApp.Commands.Send;

public class SendWhatsAppMessageCommandHandlerTests
{
    private static SendWhatsAppMessageCommandHandler CreateHandler(
        out ICustomerRepository customerRepository,
        out IOrderRepository orderRepository,
        out IWhatsAppMessageRepository messageRepository,
        out IWhatsAppSender sender)
    {
        customerRepository = Substitute.For<ICustomerRepository>();
        orderRepository = Substitute.For<IOrderRepository>();
        messageRepository = Substitute.For<IWhatsAppMessageRepository>();
        sender = Substitute.For<IWhatsAppSender>();
        return new SendWhatsAppMessageCommandHandler(messageRepository, customerRepository, orderRepository, sender);
    }

    [Fact]
    public async Task Handle_WhenSendSucceeds_PersistsPendingThenMarksSent()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var handler = CreateHandler(out var customerRepository, out _, out var messageRepository, out var sender);
        customerRepository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        sender.SendTextMessageAsync(customer.PhoneNumber, "Your order is ready.", Arg.Any<CancellationToken>())
            .Returns(WhatsAppSendResult.Succeeded("wamid.123"));

        var result = await handler.Handle(
            new SendWhatsAppMessageCommand(customer.Id, null, WhatsAppMessageType.OrderStatusUpdate, "Your order is ready."), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(WhatsAppMessageStatus.Sent, result.Value.Status);
        Assert.Equal("wamid.123", result.Value.ProviderMessageId);
        await messageRepository.Received(2).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenSendFails_PersistsPendingThenMarksFailed()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var handler = CreateHandler(out var customerRepository, out _, out var messageRepository, out var sender);
        customerRepository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        sender.SendTextMessageAsync(customer.PhoneNumber, "Reminder.", Arg.Any<CancellationToken>())
            .Returns(WhatsAppSendResult.Failed("WhatsApp integration is not configured."));

        var result = await handler.Handle(
            new SendWhatsAppMessageCommand(customer.Id, null, WhatsAppMessageType.Custom, "Reminder."), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(WhatsAppMessageStatus.Failed, result.Value.Status);
        Assert.Equal("WhatsApp integration is not configured.", result.Value.FailureReason);
        await messageRepository.Received(2).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownCustomer_ReturnsNotFound()
    {
        var handler = CreateHandler(out var customerRepository, out _, out var messageRepository, out var sender);
        customerRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Customer?)null);

        var result = await handler.Handle(
            new SendWhatsAppMessageCommand(Guid.NewGuid(), null, WhatsAppMessageType.Custom, "Hi"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Customer.NotFound", result.Error.Code);
        await sender.DidNotReceive().SendTextMessageAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        await messageRepository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownOrder_ReturnsNotFound()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var handler = CreateHandler(out var customerRepository, out var orderRepository, out var messageRepository, out var sender);
        customerRepository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        orderRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Order?)null);

        var result = await handler.Handle(
            new SendWhatsAppMessageCommand(customer.Id, Guid.NewGuid(), WhatsAppMessageType.OrderStatusUpdate, "Update"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Order.NotFound", result.Error.Code);
        await messageRepository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
