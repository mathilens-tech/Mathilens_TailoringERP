using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.Delete;

public sealed record DeleteOrderCommand(Guid Id) : ICommand<Result>;
