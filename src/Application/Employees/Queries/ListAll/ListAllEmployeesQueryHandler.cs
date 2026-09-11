using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Employees;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Queries.ListAll;

public sealed class ListAllEmployeesQueryHandler : IQueryHandler<ListAllEmployeesQuery, Result<IReadOnlyList<EmployeeDto>>>
{
    private readonly IEmployeeRepository _employeeRepository;

    public ListAllEmployeesQueryHandler(IEmployeeRepository employeeRepository)
    {
        _employeeRepository = employeeRepository;
    }

    public async Task<Result<IReadOnlyList<EmployeeDto>>> Handle(ListAllEmployeesQuery query, CancellationToken cancellationToken)
    {
        var employees = await _employeeRepository.ListAllAsync(cancellationToken);

        return Result.Success<IReadOnlyList<EmployeeDto>>(employees.Select(e => e.ToDto()).ToList());
    }
}
