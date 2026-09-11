using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Employees;
using MathilensERP.Application.Orders;
using MathilensERP.Application.Pricing;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.Create;

public sealed class CreateOrderCommandHandler : ICommandHandler<CreateOrderCommand, Result<OrderDto>>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ICustomerRepository _customerRepository;
    private readonly IEmployeeRepository _employeeRepository;
    private readonly IClothPriceRepository _clothPriceRepository;
    private readonly IOrderNumberGenerator _orderNumbers;

    public CreateOrderCommandHandler(
        IOrderRepository orderRepository,
        ICustomerRepository customerRepository,
        IEmployeeRepository employeeRepository,
        IClothPriceRepository clothPriceRepository,
        IOrderNumberGenerator orderNumbers)
    {
        _orderRepository = orderRepository;
        _customerRepository = customerRepository;
        _employeeRepository = employeeRepository;
        _clothPriceRepository = clothPriceRepository;
        _orderNumbers = orderNumbers;
    }

    public async Task<Result<OrderDto>> Handle(CreateOrderCommand command, CancellationToken cancellationToken)
    {
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

        // Last of the checks, so a customer or employee that does not exist fails before a number is
        // spent on an order that was never going to be created.
        var orderNumber = await _orderNumbers.NextAsync(cancellationToken);

        var order = command.IsFabricSale
            ? Order.CreateFabricSale(command.CustomerId, command.DueAtUtc, command.Notes, orderNumber)
            : Order.Create(command.CustomerId, command.DueAtUtc, command.EmployeeId, command.Notes, orderNumber);

        foreach (var itemInput in command.Items)
        {
            var item = order.AddItem(itemInput.GarmentType, itemInput.Quantity, itemInput.UnitPrice);

            if (itemInput.Fabric is { } fabric)
            {
                // Resolved here, not trusted from the request: the id decides whether this cloth
                // comes off stock, so it has to come from the shop's own catalogue. An unmatched
                // code is kept as typed rather than refused — the field has always taken free text.
                var clothPrice = string.IsNullOrWhiteSpace(fabric.ClothCode)
                    ? null
                    : await _clothPriceRepository.GetByClothCodeAsync(fabric.ClothCode.Trim(), cancellationToken);

                order.SetItemFabric(
                    item.Id,
                    fabric.FabricType,
                    fabric.Source,
                    fabric.Color,
                    fabric.Quantity,
                    clothPrice?.Id,
                    fabric.ClothCode,
                    fabric.Unit);
            }
        }

        // After the lines are on it, not before: the order has to be open to accept them, so a sale
        // is built like any other order and then closed. See Order.SealAsSale.
        if (command.IsFabricSale)
        {
            order.SealAsSale(command.DueAtUtc);
        }

        _orderRepository.Add(order);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        return order.ToDto();
    }
}
