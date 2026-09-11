using MathilensERP.Domain.Orders;

namespace MathilensERP.Application.Orders;

internal static class OrderMapper
{
    /// <summary>
    /// <paramref name="amountPaid"/> comes from billing, which the order aggregate knows nothing
    /// about, so the read paths look it up and pass it in. Left null by the command handlers —
    /// they return the order they just changed, and enriching that with a billing query would put
    /// a dependency on invoices into eight handlers that have no business with them.
    /// </summary>
    public static OrderDto ToDto(this Order order, decimal? amountPaid = null) =>
        new(
            order.Id,
            order.OrderNumber,
            order.CustomerId,
            order.EmployeeId,
            order.Status,
            order.DueAtUtc,
            order.DeliveredAtUtc,
            order.Notes,
            order.CreatedAtUtc,
            order.TotalAmount,
            amountPaid,
            amountPaid is null ? null : order.TotalAmount - amountPaid,
            order.Items.Select(i => i.ToDto()).ToList());

    private static OrderItemDto ToDto(this OrderItem item) =>
        new(item.Id, item.GarmentType, item.Quantity, item.UnitPrice, item.Fabric?.ToDto());

    private static FabricDetailsDto ToDto(this FabricDetails fabric) =>
        new(fabric.FabricType, fabric.Source, fabric.Color, fabric.Quantity);
}
