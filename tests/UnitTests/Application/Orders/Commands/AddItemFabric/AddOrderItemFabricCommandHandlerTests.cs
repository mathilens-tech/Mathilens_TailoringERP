using MathilensERP.Application.Orders;
using MathilensERP.Application.Orders.Commands.AddItemFabric;
using MathilensERP.Application.Pricing;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Orders.Commands.AddItemFabric;

public class AddOrderItemFabricCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingItem_AddsFabric()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var item = order.AddItem(GarmentTypes.Shirt, 1, 500m);
        var repository = Substitute.For<IOrderRepository>();
        repository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var handler = new AddOrderItemFabricCommandHandler(repository, Substitute.For<IClothPriceRepository>());
        var command = new AddOrderItemFabricCommand(order.Id, item.Id, "Cotton", FabricSource.CustomerSupplied, "Red", 2m);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items[0].Fabrics);
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_CalledTwice_KeepsBothCloths()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var item = order.AddItem(GarmentTypes.Shirt, 16, 500m);
        var repository = Substitute.For<IOrderRepository>();
        repository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var handler = new AddOrderItemFabricCommandHandler(repository, Substitute.For<IClothPriceRepository>());

        await handler.Handle(new AddOrderItemFabricCommand(order.Id, item.Id, "Cotton", FabricSource.ShopSupplied, "Blue", 2m, 300m), CancellationToken.None);
        var result = await handler.Handle(new AddOrderItemFabricCommand(order.Id, item.Id, "Linen", FabricSource.ShopSupplied, "White", 1m, 450m), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Items[0].Fabrics.Count);
        // Cloth amount is each length times its own rate: 2 × 300 + 1 × 450.
        Assert.Equal(1050m, result.Value.Items[0].ClothAmount);
    }

    [Fact]
    public async Task Handle_WithUnknownOrder_ReturnsNotFound()
    {
        var repository = Substitute.For<IOrderRepository>();
        repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Order?)null);
        var handler = new AddOrderItemFabricCommandHandler(repository, Substitute.For<IClothPriceRepository>());
        var command = new AddOrderItemFabricCommand(Guid.NewGuid(), Guid.NewGuid(), "Cotton", FabricSource.ShopSupplied, null, 2m);

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
        var handler = new AddOrderItemFabricCommandHandler(repository, Substitute.For<IClothPriceRepository>());
        var command = new AddOrderItemFabricCommand(order.Id, Guid.NewGuid(), "Cotton", FabricSource.ShopSupplied, null, 2m);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("OrderItem.NotFound", result.Error.Code);
    }
}
