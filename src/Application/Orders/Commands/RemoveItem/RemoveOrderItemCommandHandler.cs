using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Constants;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.RemoveItem;

public sealed class RemoveOrderItemCommandHandler : ICommandHandler<RemoveOrderItemCommand, Result<OrderDto>>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ICurrentUserService _currentUserService;

    public RemoveOrderItemCommandHandler(IOrderRepository orderRepository, ICurrentUserService currentUserService)
    {
        _orderRepository = orderRepository;
        _currentUserService = currentUserService;
    }

    public async Task<Result<OrderDto>> Handle(RemoveOrderItemCommand command, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdAsync(command.OrderId, cancellationToken);
        if (order is null)
        {
            return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", $"No order was found with id '{command.OrderId}'."));
        }

        if (order.Items.All(i => i.Id != command.OrderItemId))
        {
            return Result.Failure<OrderDto>(Error.NotFound(
                "OrderItem.NotFound", $"No item with id '{command.OrderItemId}' was found on this order."));
        }

        if (!order.IsOpen)
        {
            return Result.Failure<OrderDto>(Error.Conflict(
                "Order.NotModifiable", $"Cannot modify items on an order that is '{order.Status}'."));
        }

        // Mirrors the aggregate's own invariant (Order.RemoveItem) as a Result rather than an
        // exception, so the API answers 409 instead of 500 — see 01_ARCHITECTURE.md § 11.
        if (order.Items.Count == 1)
        {
            return Result.Failure<OrderDto>(Error.Conflict(
                "Order.LastItem", "Cannot remove the last item from an order — cancel the order instead."));
        }

        var removedBy = _currentUserService.UserId ?? SystemUsers.SystemUserId;
        order.RemoveItem(command.OrderItemId, removedBy, DateTime.UtcNow);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        return order.ToDto();
    }
}
