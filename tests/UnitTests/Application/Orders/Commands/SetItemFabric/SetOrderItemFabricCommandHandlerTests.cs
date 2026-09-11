using MathilensERP.Application.Orders;
using MathilensERP.Application.Orders.Commands.SetItemFabric;
using MathilensERP.Application.Pricing;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Orders.Commands.SetItemFabric;

public class SetOrderItemFabricCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingItem_SetsFabric()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var item = order.AddItem(GarmentTypes.Shirt, 1, 500m);
        var repository = Substitute.For<IOrderRepository>();
        repository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var handler = new SetOrderItemFabricCommandHandler(repository, Substitute.For<IClothPriceRepository>());
        var command = new SetOrderItemFabricCommand(order.Id, item.Id, "Cotton", FabricSource.CustomerSupplied, "Red", 2m);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value.Items[0].Fabric);
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownOrder_ReturnsNotFound()
    {
        var repository = Substitute.For<IOrderRepository>();
        repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Order?)null);
        var handler = new SetOrderItemFabricCommandHandler(repository, Substitute.For<IClothPriceRepository>());
        var command = new SetOrderItemFabricCommand(Guid.NewGuid(), Guid.NewGuid(), "Cotton", FabricSource.ShopSupplied, null, 2m);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Order.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_WithUnknownItem_ReturnsNotFound()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var repository = Substitute.For<IOrderRepository>();
        repository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var handler = new SetOrderItemFabricCommandHandler(repository, Substitute.For<IClothPriceRepository>());
        var command = new SetOrderItemFabricCommand(order.Id, Guid.NewGuid(), "Cotton", FabricSource.ShopSupplied, null, 2m);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("OrderItem.NotFound", result.Error.Code);
    }
}
