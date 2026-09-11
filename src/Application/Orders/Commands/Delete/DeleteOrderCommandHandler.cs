using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Constants;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.Delete;

/// <summary>
/// Soft-deletes an order (02_DATABASE.md § 5). Deletion is for orders raised in error —
/// an order the shop actually took and then lost should be <c>Cancelled</c>, which keeps it
/// visible in reporting. Anything already billed is therefore off limits: an invoice that
/// points at a deleted order cannot be reconciled.
/// </summary>
public sealed class DeleteOrderCommandHandler : ICommandHandler<DeleteOrderCommand, Result>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly ICurrentUserService _currentUserService;

    public DeleteOrderCommandHandler(
        IOrderRepository orderRepository,
        IInvoiceRepository invoiceRepository,
        ICurrentUserService currentUserService)
    {
        _orderRepository = orderRepository;
        _invoiceRepository = invoiceRepository;
        _currentUserService = currentUserService;
    }

    public async Task<Result> Handle(DeleteOrderCommand command, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdAsync(command.Id, cancellationToken);
        if (order is null)
        {
            return Result.Failure(Error.NotFound("Order.NotFound", $"No order was found with id '{command.Id}'."));
        }

        if (await _invoiceRepository.ExistsBillableForOrderAsync(command.Id, cancellationToken))
        {
            return Result.Failure(Error.Conflict(
                "Order.Invoiced", "Cannot delete an order that has been invoiced — void the invoice first."));
        }

        var deletedBy = _currentUserService.UserId ?? SystemUsers.SystemUserId;
        order.SoftDelete(deletedBy, DateTime.UtcNow);

        await _orderRepository.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
