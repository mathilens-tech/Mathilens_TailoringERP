using MathilensERP.Application.Orders;
using MathilensERP.Application.Orders.Commands.RemoveItemFabric;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Orders.Commands.RemoveItemFabric;

public class RemoveOrderItemFabricCommandHandlerTests
{
    [Fact]
    public async Task Handle_RemovesNamedClothOnly()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var item = order.AddItem(GarmentTypes.Shirt, 2, 500m);
        var keep = order.AddItemFabric(item.Id, "Cotton", FabricSource.ShopSupplied, "Blue", 2m, 300m);
        var drop = order.AddItemFabric(item.Id, "Linen", FabricSource.ShopSupplied, "White", 1m, 450m);
        var repository = Substitute.For<IOrderRepository>();
        repository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var handler = new RemoveOrderItemFabricCommandHandler(repository);

        var result = await handler.Handle(new RemoveOrderItemFabricCommand(order.Id, item.Id, drop.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items[0].Fabrics);
        Assert.Equal(keep.Id, result.Value.Items[0].Fabrics[0].Id);
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownOrder_ReturnsNotFound()
    {
        var repository = Substitute.For<IOrderRepository>();
        repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Order?)null);
        var handler = new RemoveOrderItemFabricCommandHandler(repository);

        var result = await handler.Handle(new RemoveOrderItemFabricCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Order.NotFound", result.Error.Code);
    }
}
