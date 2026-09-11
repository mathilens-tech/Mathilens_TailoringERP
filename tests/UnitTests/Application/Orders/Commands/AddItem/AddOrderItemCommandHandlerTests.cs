using MathilensERP.Application.Orders;
using MathilensERP.Application.Orders.Commands.AddItem;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Orders.Commands.AddItem;

public class AddOrderItemCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingModifiableOrder_AddsItem()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var repository = Substitute.For<IOrderRepository>();
        repository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var handler = new AddOrderItemCommandHandler(repository);

        var result = await handler.Handle(new AddOrderItemCommand(order.Id, GarmentTypes.Trousers, 2, 300m), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownOrder_ReturnsNotFound()
    {
        var repository = Substitute.For<IOrderRepository>();
        repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Order?)null);
        var handler = new AddOrderItemCommandHandler(repository);

        var result = await handler.Handle(new AddOrderItemCommand(Guid.NewGuid(), GarmentTypes.Shirt, 1, 100m), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Order.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_WithDeliveredOrder_ReturnsConflict()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, Guid.NewGuid());
        order.TransitionTo(OrderStatus.InProgress);
        order.TransitionTo(OrderStatus.ReadyForDelivery);
        order.TransitionTo(OrderStatus.Delivered, DateTime.UtcNow);
        var repository = Substitute.For<IOrderRepository>();
        repository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var handler = new AddOrderItemCommandHandler(repository);

        var result = await handler.Handle(new AddOrderItemCommand(order.Id, GarmentTypes.Shirt, 1, 100m), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Order.NotModifiable", result.Error.Code);
        await repository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
