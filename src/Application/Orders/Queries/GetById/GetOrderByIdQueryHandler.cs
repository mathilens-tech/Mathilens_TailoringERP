using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Queries.GetById;

public sealed class GetOrderByIdQueryHandler : IQueryHandler<GetOrderByIdQuery, Result<OrderDto>>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IInvoiceRepository _invoiceRepository;

    public GetOrderByIdQueryHandler(IOrderRepository orderRepository, IInvoiceRepository invoiceRepository)
    {
        _orderRepository = orderRepository;
        _invoiceRepository = invoiceRepository;
    }

    public async Task<Result<OrderDto>> Handle(GetOrderByIdQuery query, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdAsync(query.Id, cancellationToken);
        if (order is null)
        {
            return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", $"No order was found with id '{query.Id}'."));
        }

        var paidByOrder = await _invoiceRepository.GetPaidAmountsForOrdersAsync([order.Id], cancellationToken);

        return order.ToDto(paidByOrder.TryGetValue(order.Id, out var paid) ? paid : 0m);
    }
}
