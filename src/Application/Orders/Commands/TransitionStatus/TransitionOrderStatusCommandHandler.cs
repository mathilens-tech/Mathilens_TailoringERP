using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.TransitionStatus;

/// <summary>
/// Order status transitions are validated against <see cref="Domain.Orders.Order.CanTransitionTo"/> here — never left to bubble up as an unhandled exception (01_ARCHITECTURE.md § 13 Exception Strategy).
///
/// Two transitions carry rules beyond the lifecycle graph. Work cannot start unassigned — that is
/// the order's own invariant, so it lives in <see cref="Domain.Orders.Order"/> and is mirrored here
/// as a Result. Delivery cannot happen while money is still owed — that is a billing fact spanning
/// two aggregates, so it is only checked here, where both are reachable.
/// </summary>
public sealed class TransitionOrderStatusCommandHandler : ICommandHandler<TransitionOrderStatusCommand, Result<OrderDto>>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IInvoiceRepository _invoiceRepository;

    public TransitionOrderStatusCommandHandler(IOrderRepository orderRepository, IInvoiceRepository invoiceRepository)
    {
        _orderRepository = orderRepository;
        _invoiceRepository = invoiceRepository;
    }

    public async Task<Result<OrderDto>> Handle(TransitionOrderStatusCommand command, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdAsync(command.OrderId, cancellationToken);
        if (order is null)
        {
            return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", $"No order was found with id '{command.OrderId}'."));
        }

        if (!order.CanTransitionTo(command.TargetStatus))
        {
            return Result.Failure<OrderDto>(Error.Conflict(
                "Order.InvalidStatusTransition", $"Cannot transition an order from '{order.Status}' to '{command.TargetStatus}'."));
        }

        // Mirrors the aggregate's own invariant (Order.TransitionTo) as a Result rather than an
        // exception, so the API answers 409 instead of 500 — see 01_ARCHITECTURE.md § 11.
        if (command.TargetStatus == OrderStatus.InProgress && order.RequiresEmployeeToStartWork)
        {
            return Result.Failure<OrderDto>(Error.Conflict(
                "Order.EmployeeRequired", "Assign an employee to this order before starting work on it."));
        }

        if (command.TargetStatus == OrderStatus.Delivered)
        {
            var outstanding = await _invoiceRepository.GetOutstandingAmountForOrderAsync(command.OrderId, cancellationToken);
            if (outstanding > 0)
            {
                return Result.Failure<OrderDto>(Error.Conflict(
                    "Order.PaymentPending",
                    $"This order cannot be marked as delivered while {outstanding:0.##} is still outstanding — record the payment first."));
            }
        }

        // The handler supplies the clock; the entity stays free of it. DeliveredAtUtc stays
        // caller-supplied (a late-entered handover keeps the day it happened), while the work
        // timestamps are the moment the status actually moved here.
        order.TransitionTo(command.TargetStatus, command.DeliveredAtUtc, DateTime.UtcNow);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        return order.ToDto();
    }
}
