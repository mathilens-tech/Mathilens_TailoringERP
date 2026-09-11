using MathilensERP.Application.Employees;
using MathilensERP.Application.Employees.Queries.Search;
using MathilensERP.Domain.Employees;
using MathilensERP.Shared.Pagination;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Employees.Queries.Search;

public class SearchEmployeesQueryHandlerTests
{
    [Fact]
    public async Task Handle_MapsPagedEmployeesToDtos()
    {
        var employee = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);
        var repository = Substitute.For<IEmployeeRepository>();
        repository.SearchAsync("Ravi", 1, 20, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<Employee>([employee], 1, 20, 1));
        var handler = new SearchEmployeesQueryHandler(repository);

        var result = await handler.Handle(new SearchEmployeesQuery("Ravi", 1, 20), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal(employee.Id, result.Value.Items[0].Id);
    }
}
