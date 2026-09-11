using MathilensERP.Application.Billing;
using MathilensERP.Application.Orders;
using MathilensERP.Application.Orders.Commands.TransitionStatus;
using MathilensERP.Domain.Orders;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Orders.Commands.TransitionStatus;

public class TransitionOrderStatusCommandHandlerTests
{
    private readonly IOrderRepository _orderRepository = Substitute.For<IOrderRepository>();
    private readonly IInvoiceRepository _invoiceRepository = Substitute.For<IInvoiceRepository>();

    [Fact]
    public async Task Handle_WithValidTransition_UpdatesStatus()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, Guid.NewGuid());
        _orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var handler = new TransitionOrderStatusCommandHandler(_orderRepository, _invoiceRepository);

        var result = await handler.Handle(new TransitionOrderStatusCommand(order.Id, OrderStatus.InProgress), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(OrderStatus.InProgress, result.Value.Status);
        await _orderRepository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_StartingWorkWithNoEmployeeAssigned_ReturnsConflict()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        _orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var handler = new TransitionOrderStatusCommandHandler(_orderRepository, _invoiceRepository);

        var result = await handler.Handle(new TransitionOrderStatusCommand(order.Id, OrderStatus.InProgress), CancellationToken.None);

        // A Result, not the aggregate's exception — so the API answers 409 rather than 500.
        Assert.True(result.IsFailure);
        Assert.Equal("Order.EmployeeRequired", result.Error.Code);
        Assert.Equal(OrderStatus.Received, order.Status);
        await _orderRepository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithInvalidTransition_ReturnsConflict()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        _orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var handler = new TransitionOrderStatusCommandHandler(_orderRepository, _invoiceRepository);

        var result = await handler.Handle(
            new TransitionOrderStatusCommand(order.Id, OrderStatus.Delivered, DateTime.UtcNow), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Order.InvalidStatusTransition", result.Error.Code);
        await _orderRepository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownOrder_ReturnsNotFound()
    {
        _orderRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Order?)null);
        var handler = new TransitionOrderStatusCommandHandler(_orderRepository, _invoiceRepository);

        var result = await handler.Handle(new TransitionOrderStatusCommand(Guid.NewGuid(), OrderStatus.InProgress), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Order.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_DeliveringWithAnOutstandingAmount_ReturnsConflict()
    {
        var order = ReadyForDeliveryOrder();
        _orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        _invoiceRepository.GetOutstandingAmountForOrderAsync(order.Id, Arg.Any<CancellationToken>()).Returns(250m);
        var handler = new TransitionOrderStatusCommandHandler(_orderRepository, _invoiceRepository);

        var result = await handler.Handle(
            new TransitionOrderStatusCommand(order.Id, OrderStatus.Delivered, DateTime.UtcNow), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Order.PaymentPending", result.Error.Code);
        Assert.Equal(OrderStatus.ReadyForDelivery, order.Status);
        await _orderRepository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_DeliveringWithNothingOutstanding_RecordsTheDeliveryDate()
    {
        var order = ReadyForDeliveryOrder();
        var deliveredAtUtc = new DateTime(2026, 8, 9, 0, 0, 0, DateTimeKind.Utc);
        _orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        _invoiceRepository.GetOutstandingAmountForOrderAsync(order.Id, Arg.Any<CancellationToken>()).Returns(0m);
        var handler = new TransitionOrderStatusCommandHandler(_orderRepository, _invoiceRepository);

        var result = await handler.Handle(
            new TransitionOrderStatusCommand(order.Id, OrderStatus.Delivered, deliveredAtUtc), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(OrderStatus.Delivered, result.Value.Status);
        Assert.Equal(deliveredAtUtc, result.Value.DeliveredAtUtc);
        await _orderRepository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithANonDeliveryTransition_DoesNotCheckTheBalance()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        _orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var handler = new TransitionOrderStatusCommandHandler(_orderRepository, _invoiceRepository);

        var result = await handler.Handle(new TransitionOrderStatusCommand(order.Id, OrderStatus.Cancelled), CancellationToken.None);

        Assert.True(result.IsSuccess);
        await _invoiceRepository.DidNotReceive().GetOutstandingAmountForOrderAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    private static Order ReadyForDeliveryOrder()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, Guid.NewGuid());
        order.TransitionTo(OrderStatus.InProgress);
        order.TransitionTo(OrderStatus.ReadyForDelivery);
        return order;
    }
}
