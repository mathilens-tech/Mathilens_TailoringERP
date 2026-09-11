using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.Update;

public sealed record UpdateOrderCommand(
    Guid Id,
    Guid CustomerId,
    Guid? EmployeeId,
    DateTime DueAtUtc,
    string? Notes) : ICommand<Result<OrderDto>>;
