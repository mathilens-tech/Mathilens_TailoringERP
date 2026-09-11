using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.UpdateItem;

public sealed class UpdateOrderItemCommandHandler : ICommandHandler<UpdateOrderItemCommand, Result<OrderDto>>
{
    private readonly IOrderRepository _orderRepository;

    public UpdateOrderItemCommandHandler(IOrderRepository orderRepository)
    {
        _orderRepository = orderRepository;
    }

    public async Task<Result<OrderDto>> Handle(UpdateOrderItemCommand command, CancellationToken cancellationToken)
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

        order.UpdateItem(command.OrderItemId, command.GarmentType, command.Quantity, command.UnitPrice);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        return order.ToDto();
    }
}
