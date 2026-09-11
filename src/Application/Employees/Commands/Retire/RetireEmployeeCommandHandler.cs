using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Employees;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Commands.Retire;

public sealed class RetireEmployeeCommandHandler : ICommandHandler<RetireEmployeeCommand, Result<EmployeeDto>>
{
    private readonly IEmployeeRepository _employeeRepository;

    public RetireEmployeeCommandHandler(IEmployeeRepository employeeRepository)
    {
        _employeeRepository = employeeRepository;
    }

    public async Task<Result<EmployeeDto>> Handle(RetireEmployeeCommand command, CancellationToken cancellationToken)
    {
        var employee = await _employeeRepository.GetByIdAsync(command.Id, cancellationToken);
        if (employee is null)
        {
            return Result.Failure<EmployeeDto>(
                Error.NotFound("Employee.NotFound", $"No employee was found with id '{command.Id}'."));
        }

        if (command.LastWorkingDate is { } lastWorkingDate)
        {
            if (lastWorkingDate < employee.JoiningDate)
            {
                return Result.Failure<EmployeeDto>(Error.Validation(
                    "Employee.LastWorkingDateBeforeJoining",
                    $"The last working date cannot be before the joining date ({employee.JoiningDate:yyyy-MM-dd})."));
            }

            employee.Retire(lastWorkingDate);
        }
        else
        {
            employee.ReturnToWork();
        }

        await _employeeRepository.SaveChangesAsync(cancellationToken);

        return employee.ToDto();
    }
}
