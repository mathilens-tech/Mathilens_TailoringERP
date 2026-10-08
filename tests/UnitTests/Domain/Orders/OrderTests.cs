using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;

namespace MathilensERP.UnitTests.Domain.Orders;

public class OrderTests
{
    [Fact]
    public void Create_WithValidInputs_StartsInReceivedStatusWithNoItems()
    {
        var customerId = Guid.NewGuid();
        var dueAtUtc = DateTime.UtcNow.AddDays(7);

        var order = Order.Create(customerId, dueAtUtc, null);

        Assert.NotEqual(Guid.Empty, order.Id);
        Assert.Equal(customerId, order.CustomerId);
        Assert.Null(order.EmployeeId);
        Assert.Equal(dueAtUtc, order.DueAtUtc);
        Assert.Equal(OrderStatus.Received, order.Status);
        Assert.Empty(order.Items);
    }

    [Fact]
    public void Create_WithEmptyCustomerId_Throws()
    {
        Assert.Throws<ArgumentException>(() => Order.Create(Guid.Empty, DateTime.UtcNow, null));
    }

    [Fact]
    public void AddItem_WithValidInputs_AddsItemToOrder()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);

        var item = order.AddItem(GarmentTypes.Shirt, 2, 500m);

        Assert.Single(order.Items);
        Assert.Equal(GarmentTypes.Shirt, item.GarmentType);
        Assert.Equal(2, item.Quantity);
        Assert.Equal(500m, item.UnitPrice);
        Assert.Empty(item.Fabrics);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void AddItem_WithNonPositiveQuantity_Throws(int quantity)
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);

        Assert.Throws<ArgumentOutOfRangeException>(() => order.AddItem(GarmentTypes.Shirt, quantity, 500m));
    }

    [Fact]
    public void AddItem_WithNonPositiveUnitPrice_Throws()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);

        Assert.Throws<ArgumentOutOfRangeException>(() => order.AddItem(GarmentTypes.Shirt, 1, 0m));
    }

    [Fact]
    public void AddItemFabric_WithExistingItem_AddsFabric()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var item = order.AddItem(GarmentTypes.Shirt, 1, 500m);

        order.AddItemFabric(item.Id, "Cotton", FabricSource.ShopSupplied, "Blue", 2.5m);

        Assert.Single(item.Fabrics);
        Assert.Equal("Cotton", item.Fabrics[0].FabricType);
        Assert.Equal(FabricSource.ShopSupplied, item.Fabrics[0].Source);
        Assert.Equal("Blue", item.Fabrics[0].Color);
        Assert.Equal(2.5m, item.Fabrics[0].Quantity);
    }

    [Fact]
    public void AddItemFabric_CalledForSeveralCloths_KeepsAllAndSumsClothAmount()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var item = order.AddItem(GarmentTypes.Shirt, 16, 500m);

        order.AddItemFabric(item.Id, "Cotton", FabricSource.ShopSupplied, "Blue", 2m, 300m);
        order.AddItemFabric(item.Id, "Linen", FabricSource.ShopSupplied, "White", 1m, 450m);

        Assert.Equal(2, item.Fabrics.Count);
        // Each cloth billed at its own rate: 2 × 300 + 1 × 450.
        Assert.Equal(1050m, item.ClothAmount);
        // Stitching (16 × 500) plus cloth.
        Assert.Equal(16 * 500m + 1050m, item.LineTotal);
    }

    [Fact]
    public void RemoveItemFabric_DropsNamedClothOnly()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var item = order.AddItem(GarmentTypes.Shirt, 2, 500m);
        var keep = order.AddItemFabric(item.Id, "Cotton", FabricSource.ShopSupplied, "Blue", 2m, 300m);
        var drop = order.AddItemFabric(item.Id, "Linen", FabricSource.ShopSupplied, "White", 1m, 450m);

        order.RemoveItemFabric(item.Id, drop.Id);

        Assert.Single(item.Fabrics);
        Assert.Equal(keep.Id, item.Fabrics[0].Id);
    }

    [Fact]
    public void AddItemFabric_WithUnknownItemId_Throws()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);

        Assert.Throws<InvalidOperationException>(() =>
            order.AddItemFabric(Guid.NewGuid(), "Cotton", FabricSource.ShopSupplied, null, 2m));
    }

    [Fact]
    public void AssignEmployee_SetsEmployeeId()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var employeeId = Guid.NewGuid();

        order.AssignEmployee(employeeId);

        Assert.Equal(employeeId, order.EmployeeId);
    }

    [Theory]
    [InlineData(OrderStatus.Received, OrderStatus.InProgress, true)]
    [InlineData(OrderStatus.Received, OrderStatus.Cancelled, true)]
    [InlineData(OrderStatus.Received, OrderStatus.ReadyForDelivery, false)]
    [InlineData(OrderStatus.Received, OrderStatus.Delivered, false)]
    [InlineData(OrderStatus.InProgress, OrderStatus.ReadyForDelivery, true)]
    [InlineData(OrderStatus.InProgress, OrderStatus.Delivered, false)]
    [InlineData(OrderStatus.ReadyForDelivery, OrderStatus.Delivered, true)]
    [InlineData(OrderStatus.Delivered, OrderStatus.Cancelled, false)]
    [InlineData(OrderStatus.Cancelled, OrderStatus.InProgress, false)]
    public void CanTransitionTo_ReflectsTheEnforcedLifecycle(OrderStatus from, OrderStatus to, bool expected)
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        AdvanceTo(order, from);

        Assert.Equal(expected, order.CanTransitionTo(to));
    }

    [Fact]
    public void TransitionTo_WithValidTransition_UpdatesStatus()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, Guid.NewGuid());

        order.TransitionTo(OrderStatus.InProgress);

        Assert.Equal(OrderStatus.InProgress, order.Status);
    }

    [Fact]
    public void TransitionTo_InProgressWithNoEmployeeAssigned_Throws()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);

        // The lifecycle allows the move — it is the missing tailor that blocks it, so the order
        // stays where it was rather than starting work nobody owns.
        Assert.True(order.CanTransitionTo(OrderStatus.InProgress));
        Assert.Throws<InvalidOperationException>(() => order.TransitionTo(OrderStatus.InProgress));
        Assert.Equal(OrderStatus.Received, order.Status);
        Assert.Null(order.WorkStartedAtUtc);
    }

    [Fact]
    public void TransitionTo_InProgressAfterAssigningAnEmployee_Starts()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        order.AssignEmployee(Guid.NewGuid());

        order.TransitionTo(OrderStatus.InProgress);

        Assert.Equal(OrderStatus.InProgress, order.Status);
    }

    [Fact]
    public void TransitionTo_CancelledWithNoEmployeeAssigned_IsAllowed()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);

        // Only starting work needs an owner. An order can always be abandoned.
        order.TransitionTo(OrderStatus.Cancelled);

        Assert.Equal(OrderStatus.Cancelled, order.Status);
    }

    [Fact]
    public void TransitionTo_WithInvalidTransition_Throws()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);

        Assert.Throws<InvalidOperationException>(() => order.TransitionTo(OrderStatus.Delivered));
    }

    [Fact]
    public void TransitionTo_Delivered_RecordsTheDeliveryDate()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        AdvanceTo(order, OrderStatus.ReadyForDelivery);
        var deliveredAtUtc = new DateTime(2026, 8, 9, 0, 0, 0, DateTimeKind.Utc);

        order.TransitionTo(OrderStatus.Delivered, deliveredAtUtc);

        Assert.Equal(OrderStatus.Delivered, order.Status);
        Assert.Equal(deliveredAtUtc, order.DeliveredAtUtc);
    }

    [Fact]
    public void TransitionTo_DeliveredWithoutADate_Throws()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        AdvanceTo(order, OrderStatus.ReadyForDelivery);

        Assert.Throws<ArgumentNullException>(() => order.TransitionTo(OrderStatus.Delivered));
        Assert.Equal(OrderStatus.ReadyForDelivery, order.Status);
    }

    [Fact]
    public void TransitionTo_NonDelivered_LeavesTheDeliveryDateUnset()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, Guid.NewGuid());

        order.TransitionTo(OrderStatus.InProgress);

        Assert.Null(order.DeliveredAtUtc);
    }

    [Fact]
    public void IsOpen_IsFalseOnceDelivered()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        AdvanceTo(order, OrderStatus.Delivered);

        Assert.False(order.IsOpen);
    }

    [Fact]
    public void AddItem_OnDeliveredOrder_Throws()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        AdvanceTo(order, OrderStatus.Delivered);

        Assert.Throws<InvalidOperationException>(() => order.AddItem(GarmentTypes.Shirt, 1, 100m));
    }

    [Fact]
    public void UpdateDetails_OnOpenOrder_ReplacesHeaderFields()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var newCustomerId = Guid.NewGuid();
        var newEmployeeId = Guid.NewGuid();
        var newDueAt = DateTime.UtcNow.AddDays(14);

        order.UpdateDetails(newCustomerId, newEmployeeId, newDueAt, "Rush job");

        Assert.Equal(newCustomerId, order.CustomerId);
        Assert.Equal(newEmployeeId, order.EmployeeId);
        Assert.Equal(newDueAt, order.DueAtUtc);
        Assert.Equal("Rush job", order.Notes);
    }

    [Fact]
    public void UpdateDetails_WithEmptyCustomerId_Throws()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);

        Assert.Throws<ArgumentException>(() => order.UpdateDetails(Guid.Empty, null, DateTime.UtcNow, null));
    }

    [Fact]
    public void UpdateDetails_OnDeliveredOrder_Throws()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        order.AddItem(GarmentTypes.Shirt, 1, 100m);
        AdvanceTo(order, OrderStatus.Delivered);

        Assert.Throws<InvalidOperationException>(() => order.UpdateDetails(Guid.NewGuid(), null, DateTime.UtcNow, null));
    }

    [Fact]
    public void UpdateItem_WithValidInputs_ReplacesItemFieldsAndKeepsFabric()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var item = order.AddItem(GarmentTypes.Shirt, 2, 500m);
        order.AddItemFabric(item.Id, "Cotton", FabricSource.ShopSupplied, "Blue", 3m);

        order.UpdateItem(item.Id, GarmentTypes.Blazer, 5, 900m);

        Assert.Equal(GarmentTypes.Blazer, item.GarmentType);
        Assert.Equal(5, item.Quantity);
        Assert.Equal(900m, item.UnitPrice);
        Assert.Single(item.Fabrics);
        Assert.Equal("Cotton", item.Fabrics[0].FabricType);
    }

    [Fact]
    public void UpdateItem_WithNonPositiveQuantity_Throws()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var item = order.AddItem(GarmentTypes.Shirt, 2, 500m);

        Assert.Throws<ArgumentOutOfRangeException>(() => order.UpdateItem(item.Id, GarmentTypes.Shirt, 0, 500m));
    }

    [Fact]
    public void UpdateItem_WithUnknownItemId_Throws()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        order.AddItem(GarmentTypes.Shirt, 1, 100m);

        Assert.Throws<InvalidOperationException>(() => order.UpdateItem(Guid.NewGuid(), GarmentTypes.Shirt, 1, 100m));
    }

    [Fact]
    public void RemoveItem_WithMoreThanOneItem_SoftDeletesItAndDropsItFromItems()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var first = order.AddItem(GarmentTypes.Shirt, 1, 100m);
        order.AddItem(GarmentTypes.Trousers, 1, 200m);

        order.RemoveItem(first.Id, Guid.NewGuid(), DateTime.UtcNow);

        Assert.True(first.IsDeleted);
        Assert.Single(order.Items);
        Assert.DoesNotContain(order.Items, i => i.Id == first.Id);
    }

    [Fact]
    public void RemoveItem_WithOnlyOneItem_Throws()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var only = order.AddItem(GarmentTypes.Shirt, 1, 100m);

        Assert.Throws<InvalidOperationException>(() => order.RemoveItem(only.Id, Guid.NewGuid(), DateTime.UtcNow));
    }

    [Fact]
    public void RemoveItem_TwiceForTheSameItem_Throws()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var first = order.AddItem(GarmentTypes.Shirt, 1, 100m);
        order.AddItem(GarmentTypes.Trousers, 1, 200m);
        order.RemoveItem(first.Id, Guid.NewGuid(), DateTime.UtcNow);

        // Already-removed items are invisible to the aggregate, so this is an unknown id.
        Assert.Throws<InvalidOperationException>(() => order.RemoveItem(first.Id, Guid.NewGuid(), DateTime.UtcNow));
    }

    [Fact]
    public void RemoveItem_OnDeliveredOrder_Throws()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var first = order.AddItem(GarmentTypes.Shirt, 1, 100m);
        order.AddItem(GarmentTypes.Trousers, 1, 200m);
        AdvanceTo(order, OrderStatus.Delivered);

        Assert.Throws<InvalidOperationException>(() => order.RemoveItem(first.Id, Guid.NewGuid(), DateTime.UtcNow));
    }

    private static void AdvanceTo(Order order, OrderStatus target)
    {
        if (target == OrderStatus.Received)
        {
            return;
        }

        if (target == OrderStatus.Cancelled)
        {
            order.TransitionTo(OrderStatus.Cancelled);
            return;
        }

        // Any order that legitimately reaches InProgress has a tailor holding it, so the helper
        // supplies one. Tests about that rule itself assign (or withhold) the employee explicitly.
        if (order.RequiresEmployeeToStartWork)
        {
            order.AssignEmployee(Guid.NewGuid());
        }

        order.TransitionTo(OrderStatus.InProgress);
        if (target == OrderStatus.InProgress)
        {
            return;
        }

        order.TransitionTo(OrderStatus.ReadyForDelivery);
        if (target == OrderStatus.ReadyForDelivery)
        {
            return;
        }

        order.TransitionTo(OrderStatus.Delivered, DateTime.UtcNow);
    }
}
