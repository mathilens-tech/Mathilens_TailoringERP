using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Employees;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.Update;

public sealed class UpdateOrderCommandHandler : ICommandHandler<UpdateOrderCommand, Result<OrderDto>>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ICustomerRepository _customerRepository;
    private readonly IEmployeeRepository _employeeRepository;

    public UpdateOrderCommandHandler(
        IOrderRepository orderRepository,
        ICustomerRepository customerRepository,
        IEmployeeRepository employeeRepository)
    {
        _orderRepository = orderRepository;
        _customerRepository = customerRepository;
        _employeeRepository = employeeRepository;
    }

    public async Task<Result<OrderDto>> Handle(UpdateOrderCommand command, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdAsync(command.Id, cancellationToken);
        if (order is null)
        {
            return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", $"No order was found with id '{command.Id}'."));
        }

        if (!order.IsOpen)
        {
            return Result.Failure<OrderDto>(Error.Conflict(
                "Order.NotModifiable", $"Cannot update an order that is '{order.Status}'."));
        }

        var customer = await _customerRepository.GetByIdAsync(command.CustomerId, cancellationToken);
        if (customer is null)
        {
            return Result.Failure<OrderDto>(
                Error.NotFound("Customer.NotFound", $"No customer was found with id '{command.CustomerId}'."));
        }

        if (command.EmployeeId is { } employeeId)
        {
            var employee = await _employeeRepository.GetByIdAsync(employeeId, cancellationToken);
            if (employee is null)
            {
                return Result.Failure<OrderDto>(
                    Error.NotFound("Employee.NotFound", $"No employee was found with id '{employeeId}'."));
            }
        }

        order.UpdateDetails(command.CustomerId, command.EmployeeId, command.DueAtUtc, command.Notes);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        return order.ToDto();
    }
}
