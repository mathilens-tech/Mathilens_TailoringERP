namespace MathilensERP.Api.Contracts.Employees;

using MathilensERP.Domain.Employees;

public sealed record UpdateEmployeeRequest(
    string EmployeeCode,
    string FullName,
    string? JobTitle,
    string PhoneNumber,
    string? Email,
    DateOnly JoiningDate,
    EmploymentType EmploymentType);
