using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Employees;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Queries.ListAll;

/// <summary>Every employee, unpaginated — backs the spreadsheet export.</summary>
public sealed record ListAllEmployeesQuery : IQuery<Result<IReadOnlyList<EmployeeDto>>>;
