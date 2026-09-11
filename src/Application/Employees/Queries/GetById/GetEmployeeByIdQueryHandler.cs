using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Employees;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Queries.GetById;

public sealed class GetEmployeeByIdQueryHandler : IQueryHandler<GetEmployeeByIdQuery, Result<EmployeeDto>>
{
    private readonly IEmployeeRepository _employeeRepository;

    public GetEmployeeByIdQueryHandler(IEmployeeRepository employeeRepository)
    {
        _employeeRepository = employeeRepository;
    }

    public async Task<Result<EmployeeDto>> Handle(GetEmployeeByIdQuery query, CancellationToken cancellationToken)
    {
        var employee = await _employeeRepository.GetByIdAsync(query.Id, cancellationToken);

        return employee is null
            ? Result.Failure<EmployeeDto>(Error.NotFound("Employee.NotFound", $"No employee was found with id '{query.Id}'."))
            : employee.ToDto();
    }
}
