using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Employees;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.AssignEmployee;

public sealed class AssignOrderEmployeeCommandHandler : ICommandHandler<AssignOrderEmployeeCommand, Result<OrderDto>>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IEmployeeRepository _employeeRepository;

    public AssignOrderEmployeeCommandHandler(IOrderRepository orderRepository, IEmployeeRepository employeeRepository)
    {
        _orderRepository = orderRepository;
        _employeeRepository = employeeRepository;
    }

    public async Task<Result<OrderDto>> Handle(AssignOrderEmployeeCommand command, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdAsync(command.OrderId, cancellationToken);
        if (order is null)
        {
            return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", $"No order was found with id '{command.OrderId}'."));
        }

        var employee = await _employeeRepository.GetByIdAsync(command.EmployeeId, cancellationToken);
        if (employee is null)
        {
            return Result.Failure<OrderDto>(Error.NotFound("Employee.NotFound", $"No employee was found with id '{command.EmployeeId}'."));
        }

        order.AssignEmployee(command.EmployeeId);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        return order.ToDto();
    }
}
