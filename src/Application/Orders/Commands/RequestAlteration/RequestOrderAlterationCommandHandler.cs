using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.RequestAlteration;

public sealed class RequestOrderAlterationCommandHandler : ICommandHandler<RequestOrderAlterationCommand, Result<OrderDto>>
{
    private readonly IOrderRepository _orderRepository;

    public RequestOrderAlterationCommandHandler(IOrderRepository orderRepository)
    {
        _orderRepository = orderRepository;
    }

    public async Task<Result<OrderDto>> Handle(RequestOrderAlterationCommand command, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdAsync(command.OrderId, cancellationToken);
        if (order is null)
        {
            return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", $"No order was found with id '{command.OrderId}'."));
        }

        // Checked here so the caller gets a 409 with a sentence, rather than the exception the
        // entity throws. The entity keeps its own guard regardless — it is the invariant, and this
        // is the message.
        if (order.Status != OrderStatus.Delivered)
        {
            return Result.Failure<OrderDto>(Error.Conflict(
                "Order.NotDelivered",
                $"Only a delivered order can be taken back for alteration; this one is '{order.Status}'."));
        }

        order.RequestAlteration(command.Reason, command.ChargeAmount, DateTime.UtcNow);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        return order.ToDto();
    }
}
