using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Employees;
using MathilensERP.Domain.Employees;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Commands.Create;

public sealed class CreateEmployeeCommandHandler : ICommandHandler<CreateEmployeeCommand, Result<EmployeeDto>>
{
    private readonly IEmployeeRepository _employeeRepository;

    public CreateEmployeeCommandHandler(IEmployeeRepository employeeRepository)
    {
        _employeeRepository = employeeRepository;
    }

    public async Task<Result<EmployeeDto>> Handle(CreateEmployeeCommand command, CancellationToken cancellationToken)
    {
        // Both the staff code and the phone number identify one person, so either colliding is a
        // conflict rather than a save. Soft-deleted employees sit outside the global query
        // filter, so a code or number belonging only to a deleted record is free to reuse.
        var duplicate = await EmployeeUniqueness.FindConflictAsync(
            _employeeRepository, command.EmployeeCode, command.PhoneNumber, command.Email, excludeId: null, cancellationToken);
        if (duplicate is not null)
        {
            return Result.Failure<EmployeeDto>(duplicate);
        }

        var employee = Employee.Create(
            command.EmployeeCode,
            command.FullName,
            command.JobTitle,
            command.PhoneNumber,
            command.Email,
            command.JoiningDate,
            command.EmploymentType);

        _employeeRepository.Add(employee);
        await _employeeRepository.SaveChangesAsync(cancellationToken);

        return employee.ToDto();
    }
}
