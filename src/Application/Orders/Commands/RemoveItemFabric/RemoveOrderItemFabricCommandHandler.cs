using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.RemoveItemFabric;

public sealed class RemoveOrderItemFabricCommandHandler : ICommandHandler<RemoveOrderItemFabricCommand, Result<OrderDto>>
{
    private readonly IOrderRepository _orderRepository;

    public RemoveOrderItemFabricCommandHandler(IOrderRepository orderRepository)
    {
        _orderRepository = orderRepository;
    }

    public async Task<Result<OrderDto>> Handle(RemoveOrderItemFabricCommand command, CancellationToken cancellationToken)
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

        // A cloth that is not on the item is a no-op in the aggregate, so a stale remove does not
        // throw — the end state (the cloth gone) is the same either way.
        order.RemoveItemFabric(command.OrderItemId, command.FabricId);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        return order.ToDto();
    }
}
