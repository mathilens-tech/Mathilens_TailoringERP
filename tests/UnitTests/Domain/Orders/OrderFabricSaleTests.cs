using MathilensERP.Domain.Orders;

namespace MathilensERP.UnitTests.Domain.Orders;

/// <summary>
/// Cloth sold over the counter: finished when it is recorded, and never part of the stitching
/// lifecycle. These cover the rules that make that true rather than merely intended.
/// </summary>
public class OrderFabricSaleTests
{
    private static Order NewSale(DateTime? soldAtUtc = null) =>
        Order.CreateFabricSale(Guid.NewGuid(), soldAtUtc ?? DateTime.UtcNow, orderNumber: "RFA-1111");

    [Fact]
    public void CreateFabricSale_OpensReceivedSoItsLinesCanBeAdded()
    {
        // Not Sold on arrival, deliberately: AddItem refuses a finished order, so a sale created
        // already closed could never be given the cloth it exists to record.
        var sale = NewSale();

        Assert.Equal(OrderStatus.Received, sale.Status);
        Assert.True(sale.IsOpen);
        Assert.Null(sale.EmployeeId);
    }

    [Fact]
    public void CreateFabricSale_TakesTheSaleMomentAsTheDueDate()
    {
        var soldAtUtc = new DateTime(2026, 3, 4, 10, 30, 0, DateTimeKind.Utc);

        var sale = NewSale(soldAtUtc);

        // There is nothing to promise: the cloth leaves as it is bought.
        Assert.Equal(soldAtUtc, sale.DueAtUtc);
    }

    [Fact]
    public void SealAsSale_ClosesTheSaleAndStampsItAsHandedOver()
    {
        var soldAtUtc = new DateTime(2026, 3, 4, 10, 30, 0, DateTimeKind.Utc);
        var sale = NewSale(soldAtUtc);
        sale.AddItem("Fabric", 3, 250m);

        sale.SealAsSale(soldAtUtc);

        Assert.Equal(OrderStatus.Sold, sale.Status);
        // Filled rather than left null: the revenue and collection reports read this column and know
        // nothing about sales, so a null here silently drops every one of them out of the figures.
        Assert.Equal(soldAtUtc, sale.DeliveredAtUtc);
    }

    [Fact]
    public void SealAsSale_LeavesTheSaleClosedToFurtherChanges()
    {
        var sale = NewSale();
        sale.AddItem("Fabric", 3, 250m);
        sale.SealAsSale(DateTime.UtcNow);

        Assert.False(sale.IsOpen);
        // Were Sold missing from IsOpen, a recorded sale would stay editable for ever.
        Assert.Throws<InvalidOperationException>(() => sale.AddItem("Fabric", 1, 100m));
    }

    [Fact]
    public void Sold_IsTerminalAndLeadsNowhere()
    {
        var sale = NewSale();
        sale.AddItem("Fabric", 2, 300m);
        sale.SealAsSale(DateTime.UtcNow);

        foreach (var target in Enum.GetValues<OrderStatus>())
        {
            Assert.False(sale.CanTransitionTo(target));
        }
    }

    [Fact]
    public void SealAsSale_RefusesAnOrderThatIsAlreadySold()
    {
        var sale = NewSale();
        sale.AddItem("Fabric", 1, 100m);
        sale.SealAsSale(DateTime.UtcNow);

        Assert.Throws<InvalidOperationException>(() => sale.SealAsSale(DateTime.UtcNow));
    }

    [Fact]
    public void SealAsSale_RefusesAnOrderWithATailorOnIt()
    {
        // The guard that stops this being a back door: a real stitching job, assigned to somebody,
        // must not be markable Sold to skip its lifecycle.
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow.AddDays(5), Guid.NewGuid());
        order.AddItem("Shirt", 1, 500m);

        Assert.Throws<InvalidOperationException>(() => order.SealAsSale(DateTime.UtcNow));
    }

    [Fact]
    public void SealAsSale_RefusesAnOrderAlreadyBeingWorked()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow.AddDays(5), Guid.NewGuid());
        order.AddItem("Shirt", 1, 500m);
        order.TransitionTo(OrderStatus.InProgress);

        Assert.Throws<InvalidOperationException>(() => order.SealAsSale(DateTime.UtcNow));
    }

    [Fact]
    public void ATailoringOrderCanNeverReachSold()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow.AddDays(5), Guid.NewGuid());
        order.AddItem("Shirt", 1, 500m);

        Assert.False(order.CanTransitionTo(OrderStatus.Sold));

        order.TransitionTo(OrderStatus.InProgress);
        Assert.False(order.CanTransitionTo(OrderStatus.Sold));

        order.TransitionTo(OrderStatus.ReadyForDelivery);
        Assert.False(order.CanTransitionTo(OrderStatus.Sold));
    }
}
