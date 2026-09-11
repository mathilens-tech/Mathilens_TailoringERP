using MathilensERP.Domain.Employees;

namespace MathilensERP.Application.Employees;

/// <param name="IsActive">
/// Resolved server-side against the caller's today, so every screen agrees on who is still
/// employed without each one re-deriving it from <paramref name="LastWorkingDate"/>.
/// </param>
public sealed record EmployeeDto(
    Guid Id,
    string EmployeeCode,
    string FullName,
    string? JobTitle,
    string PhoneNumber,
    string? Email,
    DateOnly JoiningDate,
    EmploymentType EmploymentType,
    DateOnly? LastWorkingDate,
    bool IsActive,
    DateTime CreatedAtUtc);
