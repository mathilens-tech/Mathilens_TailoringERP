using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;

namespace MathilensERP.Application.Orders;

/// <param name="TotalAmount">The order's own value — quantity × unit price across its items, before any invoice tax or discount.</param>
/// <param name="AmountPaid">
/// Collected against this order so far. Null where the response wasn't produced by reading the
/// order — the command handlers return the aggregate they just changed and don't consult billing,
/// so null means "not looked up here", never "nothing paid".
/// </param>
/// <param name="BalanceAmount">
/// <paramref name="TotalAmount"/> − <paramref name="AmountPaid"/>, and null alongside it. Can go
/// negative where an invoice added tax on top of the order's value and was paid in full.
/// </param>
public sealed record OrderDto(
    Guid Id,
    /// <summary>The shop's own reference for this order, e.g. "MTL-0001". Empty only on fixtures.</summary>
    string OrderNumber,
    Guid CustomerId,
    Guid? EmployeeId,
    OrderStatus Status,
    DateTime DueAtUtc,
    DateTime? DeliveredAtUtc,
    string? Notes,
    DateTime CreatedAtUtc,
    decimal TotalAmount,
    decimal? AmountPaid,
    decimal? BalanceAmount,
    IReadOnlyList<OrderItemDto> Items);

public sealed record OrderItemDto(
    Guid Id,
    string GarmentType,
    int Quantity,
    decimal UnitPrice,
    FabricDetailsDto? Fabric);

public sealed record FabricDetailsDto(
    string FabricType,
    FabricSource Source,
    string? Color,
    decimal Quantity);
