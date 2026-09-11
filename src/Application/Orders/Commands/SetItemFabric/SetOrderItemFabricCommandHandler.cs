using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Application.Pricing;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.SetItemFabric;

public sealed class SetOrderItemFabricCommandHandler : ICommandHandler<SetOrderItemFabricCommand, Result<OrderDto>>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IClothPriceRepository _clothPriceRepository;

    public SetOrderItemFabricCommandHandler(IOrderRepository orderRepository, IClothPriceRepository clothPriceRepository)
    {
        _orderRepository = orderRepository;
        _clothPriceRepository = clothPriceRepository;
    }

    public async Task<Result<OrderDto>> Handle(SetOrderItemFabricCommand command, CancellationToken cancellationToken)
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

        // Same resolution as when the order was created — the id is what decides whether this
        // cloth comes off stock, so it must come from the shop's own catalogue.
        var clothPrice = string.IsNullOrWhiteSpace(command.ClothCode)
            ? null
            : await _clothPriceRepository.GetByClothCodeAsync(command.ClothCode.Trim(), cancellationToken);

        order.SetItemFabric(
            command.OrderItemId,
            command.FabricType,
            command.Source,
            command.Color,
            command.Quantity,
            clothPrice?.Id,
            command.ClothCode,
            command.Unit);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        return order.ToDto();
    }
}
