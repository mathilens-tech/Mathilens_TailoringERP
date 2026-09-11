using MathilensERP.Domain.Measurements;

namespace MathilensERP.Api.Contracts.Orders;

public sealed record AddOrderItemRequest(string GarmentType, int Quantity, decimal UnitPrice);
