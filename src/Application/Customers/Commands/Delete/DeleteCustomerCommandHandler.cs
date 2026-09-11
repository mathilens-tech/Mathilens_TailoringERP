using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Constants;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Commands.Delete;

/// <summary>
/// Deleting a customer who has order history would orphan those orders — their customer name,
/// phone and measurements are how an order is identified at the counter. A customer who has
/// stopped coming is simply left alone, not removed.
/// </summary>
public sealed class DeleteCustomerCommandHandler : ICommandHandler<DeleteCustomerCommand, Result>
{
    private readonly ICustomerRepository _customerRepository;
    private readonly IOrderRepository _orderRepository;
    private readonly ICurrentUserService _currentUserService;

    public DeleteCustomerCommandHandler(
        ICustomerRepository customerRepository,
        IOrderRepository orderRepository,
        ICurrentUserService currentUserService)
    {
        _customerRepository = customerRepository;
        _orderRepository = orderRepository;
        _currentUserService = currentUserService;
    }

    public async Task<Result> Handle(DeleteCustomerCommand command, CancellationToken cancellationToken)
    {
        var customer = await _customerRepository.GetByIdAsync(command.Id, cancellationToken);
        if (customer is null)
        {
            return Result.Failure(
                Error.NotFound("Customer.NotFound", $"No customer was found with id '{command.Id}'."));
        }

        if (await _orderRepository.ExistsForCustomerAsync(command.Id, cancellationToken))
        {
            return Result.Failure(Error.Conflict("Customer.UsedInOrders", "Customer used in Orders."));
        }

        var deletedBy = _currentUserService.UserId ?? SystemUsers.SystemUserId;
        customer.SoftDelete(deletedBy, DateTime.UtcNow);

        await _customerRepository.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
