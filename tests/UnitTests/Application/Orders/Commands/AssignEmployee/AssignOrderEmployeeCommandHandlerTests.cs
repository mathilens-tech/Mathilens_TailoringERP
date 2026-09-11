using MathilensERP.Application.Employees;
using MathilensERP.Application.Orders;
using MathilensERP.Application.Orders.Commands.AssignEmployee;
using MathilensERP.Domain.Employees;
using MathilensERP.Domain.Orders;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Orders.Commands.AssignEmployee;

public class AssignOrderEmployeeCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingOrderAndEmployee_AssignsEmployee()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var employee = Employee.Create("EMP-001", "Ravi Kumar", null, "+91 98765 43210", null, new DateOnly(2024, 1, 15), EmploymentType.FullTime);
        var orderRepository = Substitute.For<IOrderRepository>();
        orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var employeeRepository = Substitute.For<IEmployeeRepository>();
        employeeRepository.GetByIdAsync(employee.Id, Arg.Any<CancellationToken>()).Returns(employee);
        var handler = new AssignOrderEmployeeCommandHandler(orderRepository, employeeRepository);

        var result = await handler.Handle(new AssignOrderEmployeeCommand(order.Id, employee.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(employee.Id, result.Value.EmployeeId);
        await orderRepository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownEmployee_ReturnsNotFound()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var orderRepository = Substitute.For<IOrderRepository>();
        orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var employeeRepository = Substitute.For<IEmployeeRepository>();
        employeeRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Employee?)null);
        var handler = new AssignOrderEmployeeCommandHandler(orderRepository, employeeRepository);

        var result = await handler.Handle(new AssignOrderEmployeeCommand(order.Id, Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Employee.NotFound", result.Error.Code);
    }
}
