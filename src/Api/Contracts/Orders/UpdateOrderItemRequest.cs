using MathilensERP.Domain.Measurements;

namespace MathilensERP.Api.Contracts.Orders;

public sealed record UpdateOrderItemRequest(string GarmentType, int Quantity, decimal UnitPrice);
