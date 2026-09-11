using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Employees;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Commands.Update;

public sealed class UpdateEmployeeCommandHandler : ICommandHandler<UpdateEmployeeCommand, Result<EmployeeDto>>
{
    private readonly IEmployeeRepository _employeeRepository;

    public UpdateEmployeeCommandHandler(IEmployeeRepository employeeRepository)
    {
        _employeeRepository = employeeRepository;
    }

    public async Task<Result<EmployeeDto>> Handle(UpdateEmployeeCommand command, CancellationToken cancellationToken)
    {
        var employee = await _employeeRepository.GetByIdAsync(command.Id, cancellationToken);
        if (employee is null)
        {
            return Result.Failure<EmployeeDto>(
                Error.NotFound("Employee.NotFound", $"No employee was found with id '{command.Id}'."));
        }

        // Same uniqueness rule as create — but this employee's own code and number aren't clashes.
        var duplicate = await EmployeeUniqueness.FindConflictAsync(
            _employeeRepository, command.EmployeeCode, command.PhoneNumber, command.Email, command.Id, cancellationToken);
        if (duplicate is not null)
        {
            return Result.Failure<EmployeeDto>(duplicate);
        }

        employee.UpdateDetails(
            command.EmployeeCode,
            command.FullName,
            command.JobTitle,
            command.PhoneNumber,
            command.Email,
            command.JoiningDate,
            command.EmploymentType);
        await _employeeRepository.SaveChangesAsync(cancellationToken);

        return employee.ToDto();
    }
}
