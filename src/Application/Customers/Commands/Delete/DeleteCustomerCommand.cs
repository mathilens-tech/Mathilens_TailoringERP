using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Commands.Delete;

public sealed record DeleteCustomerCommand(Guid Id) : ICommand<Result>;
