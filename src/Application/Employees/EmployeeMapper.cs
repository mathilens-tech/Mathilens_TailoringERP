using MathilensERP.Domain.Employees;

namespace MathilensERP.Application.Employees;

internal static class EmployeeMapper
{
    public static EmployeeDto ToDto(this Employee employee) =>
        new(
            employee.Id,
            employee.EmployeeCode,
            employee.FullName,
            employee.JobTitle,
            employee.PhoneNumber,
            employee.Email,
            employee.JoiningDate,
            employee.EmploymentType,
            employee.LastWorkingDate,
            employee.IsActiveOn(DateOnly.FromDateTime(DateTime.UtcNow)),
            employee.CreatedAtUtc);
}
