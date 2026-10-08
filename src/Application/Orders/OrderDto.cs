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
    /// <summary>Who created the order, by name. Null where the response was produced by a write
    /// rather than a read — the command handlers return the aggregate and do not resolve names — and
    /// null for an order whose creator's account has since been removed.</summary>
    string? CreatedByName,
    decimal TotalAmount,
    decimal? AmountPaid,
    decimal? BalanceAmount,
    IReadOnlyList<OrderItemDto> Items,
    /// <summary>Every time this order came back to be altered, oldest first. Empty for almost every order.</summary>
    IReadOnlyList<OrderAlterationDto> Alterations);

/// <param name="PreviousDeliveredAtUtc">
/// When the customer had the garment before this alteration. The order's own <c>DeliveredAtUtc</c>
/// moves on when the altered garment is handed over again, so this is what remembers the earlier one.
/// </param>
public sealed record OrderAlterationDto(
    Guid Id,
    string Reason,
    decimal ChargeAmount,
    DateTime? PreviousDeliveredAtUtc,
    DateTime CreatedAtUtc);

public sealed record OrderItemDto(
    Guid Id,
    string GarmentType,
    int Quantity,
    decimal UnitPrice,
    /// <summary>Every cloth this garment is cut from — empty for a customer's own material, one
    /// entry for the ordinary single-cloth line, several when a garment is made from a few.</summary>
    IReadOnlyList<FabricDetailsDto> Fabrics,
    /// <summary>The line's cloth charge — each fabric's length × its rate, summed.</summary>
    decimal ClothAmount,
    /// <summary>What the whole line is worth: stitching × quantity + cloth.</summary>
    decimal LineTotal);

public sealed record FabricDetailsDto(
    /// <summary>Needed so a cloth can be removed by id from an existing order.</summary>
    Guid Id,
    string FabricType,
    FabricSource Source,
    string? Color,
    decimal Quantity,
    decimal RatePerMetre);
