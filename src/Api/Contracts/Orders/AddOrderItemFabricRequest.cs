using MathilensERP.Domain.Inventory;
using MathilensERP.Domain.Orders;

namespace MathilensERP.Api.Contracts.Orders;

/// <summary>One cloth to add to an item on an existing order. <c>RatePerMetre</c> is what a metre of
/// it is billed at; <c>ClothCode</c> is resolved against the price list, and a match is what lets
/// stock fall.</summary>
public sealed record AddOrderItemFabricRequest(
    string FabricType,
    FabricSource Source,
    string? Color,
    decimal Quantity,
    decimal RatePerMetre = 0m,
    string? ClothCode = null);
