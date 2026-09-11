using MathilensERP.Domain.Orders;

namespace MathilensERP.Api.Contracts.Orders;

public sealed record SetOrderItemFabricRequest(string FabricType, FabricSource Source, string? Color, decimal Quantity);
