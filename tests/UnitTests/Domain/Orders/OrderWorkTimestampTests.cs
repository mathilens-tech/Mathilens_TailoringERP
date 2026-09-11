using MathilensERP.Domain.Orders;

namespace MathilensERP.UnitTests.Domain.Orders;

/// <summary>
/// The two timestamps the employee order-history screen reports work from. Finishing the garment
/// and handing it over are separate events, and the history shows both.
/// </summary>
public class OrderWorkTimestampTests
{
    private static readonly DateTime Due = new(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);

    private static Order NewOrder() => Order.Create(Guid.NewGuid(), Due, Guid.NewGuid());

    [Fact]
    public void NewOrder_HasNeitherTimestamp()
    {
        var order = NewOrder();

        Assert.Null(order.WorkStartedAtUtc);
        Assert.Null(order.WorkCompletedAtUtc);
    }

    [Fact]
    public void MovingToInProgress_StampsWhenWorkStarted()
    {
        var order = NewOrder();
        var started = new DateTime(2026, 8, 20, 9, 30, 0, DateTimeKind.Utc);

        order.TransitionTo(OrderStatus.InProgress, occurredAtUtc: started);

        Assert.Equal(started, order.WorkStartedAtUtc);
        Assert.Null(order.WorkCompletedAtUtc);
    }

    [Fact]
    public void MovingToReadyForDelivery_StampsWhenWorkFinished_AndKeepsTheStart()
    {
        var order = NewOrder();
        var started = new DateTime(2026, 8, 20, 9, 30, 0, DateTimeKind.Utc);
        var finished = new DateTime(2026, 8, 24, 17, 0, 0, DateTimeKind.Utc);

        order.TransitionTo(OrderStatus.InProgress, occurredAtUtc: started);
        order.TransitionTo(OrderStatus.ReadyForDelivery, occurredAtUtc: finished);

        Assert.Equal(started, order.WorkStartedAtUtc);
        Assert.Equal(finished, order.WorkCompletedAtUtc);
    }

    [Fact]
    public void Delivering_LeavesTheWorkTimestampsAloneAndRecordsTheHandover()
    {
        var order = NewOrder();
        var started = new DateTime(2026, 8, 20, 9, 30, 0, DateTimeKind.Utc);
        var finished = new DateTime(2026, 8, 24, 17, 0, 0, DateTimeKind.Utc);
        var collected = new DateTime(2026, 8, 30, 11, 0, 0, DateTimeKind.Utc);

        order.TransitionTo(OrderStatus.InProgress, occurredAtUtc: started);
        order.TransitionTo(OrderStatus.ReadyForDelivery, occurredAtUtc: finished);
        order.TransitionTo(OrderStatus.Delivered, deliveredAtUtc: collected, occurredAtUtc: collected);

        // A garment can sit finished on the rack for days, so completion and collection differ.
        Assert.Equal(finished, order.WorkCompletedAtUtc);
        Assert.Equal(collected, order.DeliveredAtUtc);
        Assert.NotEqual(order.WorkCompletedAtUtc, order.DeliveredAtUtc);
    }

    [Fact]
    public void Cancelling_LeavesTheWorkTimestampsAsTheyWere()
    {
        var order = NewOrder();
        var started = new DateTime(2026, 8, 20, 9, 30, 0, DateTimeKind.Utc);

        order.TransitionTo(OrderStatus.InProgress, occurredAtUtc: started);
        order.TransitionTo(OrderStatus.Cancelled, occurredAtUtc: new DateTime(2026, 8, 21, 0, 0, 0, DateTimeKind.Utc));

        // The work did start, and abandoning it does not unmake that.
        Assert.Equal(started, order.WorkStartedAtUtc);
        Assert.Null(order.WorkCompletedAtUtc);
    }
}
