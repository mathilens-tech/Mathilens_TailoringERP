using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Employees;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees.Commands.Retire;

/// <summary>
/// Records that a staff member has left, as of their last working day.
///
/// Not a delete: their order history has to stay readable, and their code and phone stay theirs so
/// an old job card still resolves to the right person. A null <paramref name="LastWorkingDate"/>
/// reverses it, for someone recorded as leaving who did not, or who came back.
/// </summary>
public sealed record RetireEmployeeCommand(Guid Id, DateOnly? LastWorkingDate) : ICommand<Result<EmployeeDto>>;
