using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Employees;
using MathilensERP.Domain.Employees;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Commands.Create;

public sealed record CreateEmployeeCommand(
    string EmployeeCode,
    string FullName,
    string? JobTitle,
    string PhoneNumber,
    string? Email,
    DateOnly JoiningDate,
    EmploymentType EmploymentType) : ICommand<Result<EmployeeDto>>;
