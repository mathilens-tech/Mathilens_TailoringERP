using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Employees;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Queries.GetById;

public sealed record GetEmployeeByIdQuery(Guid Id) : IQuery<Result<EmployeeDto>>;
