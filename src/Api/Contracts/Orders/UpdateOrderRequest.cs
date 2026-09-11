namespace MathilensERP.Api.Contracts.Orders;

public sealed record UpdateOrderRequest(Guid CustomerId, Guid? EmployeeId, DateTime DueAtUtc, string? Notes);
