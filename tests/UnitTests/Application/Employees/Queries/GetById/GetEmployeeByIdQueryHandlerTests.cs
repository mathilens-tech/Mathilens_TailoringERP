using MathilensERP.Application.Employees;
using MathilensERP.Application.Employees.Queries.GetById;
using MathilensERP.Domain.Employees;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Employees.Queries.GetById;

public class GetEmployeeByIdQueryHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingEmployee_ReturnsDto()
    {
        var employee = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);
        var repository = Substitute.For<IEmployeeRepository>();
        repository.GetByIdAsync(employee.Id, Arg.Any<CancellationToken>()).Returns(employee);
        var handler = new GetEmployeeByIdQueryHandler(repository);

        var result = await handler.Handle(new GetEmployeeByIdQuery(employee.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(employee.Id, result.Value.Id);
    }

    [Fact]
    public async Task Handle_WithUnknownEmployee_ReturnsNotFound()
    {
        var repository = Substitute.For<IEmployeeRepository>();
        repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Employee?)null);
        var handler = new GetEmployeeByIdQueryHandler(repository);

        var result = await handler.Handle(new GetEmployeeByIdQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Employee.NotFound", result.Error.Code);
    }
}
