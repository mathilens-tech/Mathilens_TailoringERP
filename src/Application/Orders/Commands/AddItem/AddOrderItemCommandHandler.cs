using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.AddItem;

public sealed class AddOrderItemCommandHandler : ICommandHandler<AddOrderItemCommand, Result<OrderDto>>
{
    private readonly IOrderRepository _orderRepository;

    public AddOrderItemCommandHandler(IOrderRepository orderRepository)
    {
        _orderRepository = orderRepository;
    }

    public async Task<Result<OrderDto>> Handle(AddOrderItemCommand command, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdAsync(command.OrderId, cancellationToken);
        if (order is null)
        {
            return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", $"No order was found with id '{command.OrderId}'."));
        }

        if (!order.IsOpen)
        {
            return Result.Failure<OrderDto>(Error.Conflict(
                "Order.NotModifiable", $"Cannot add items to an order that is '{order.Status}'."));
        }

        order.AddItem(command.GarmentType, command.Quantity, command.UnitPrice);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        return order.ToDto();
    }
}
