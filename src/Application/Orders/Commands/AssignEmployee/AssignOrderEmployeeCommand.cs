using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.AssignEmployee;

public sealed record AssignOrderEmployeeCommand(Guid OrderId, Guid EmployeeId) : ICommand<Result<OrderDto>>;
