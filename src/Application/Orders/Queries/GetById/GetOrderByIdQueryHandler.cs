using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Queries.GetById;

public sealed class GetOrderByIdQueryHandler : IQueryHandler<GetOrderByIdQuery, Result<OrderDto>>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IUserAdminService _userAdminService;

    public GetOrderByIdQueryHandler(
        IOrderRepository orderRepository,
        IInvoiceRepository invoiceRepository,
        IUserAdminService userAdminService)
    {
        _orderRepository = orderRepository;
        _invoiceRepository = invoiceRepository;
        _userAdminService = userAdminService;
    }

    public async Task<Result<OrderDto>> Handle(GetOrderByIdQuery query, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdAsync(query.Id, cancellationToken);
        if (order is null)
        {
            return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", $"No order was found with id '{query.Id}'."));
        }

        var paidByOrder = await _invoiceRepository.GetPaidAmountsForOrdersAsync([order.Id], cancellationToken);
        // Resolved here, on the read, rather than carried on the aggregate: the order records who
        // created it as an id, and turning that into a name is a user-store lookup that belongs to
        // the read. Null when the creating account has since been removed — the screen shows a dash.
        var createdByName = await _userAdminService.GetFullNameAsync(order.CreatedBy, cancellationToken);

        return order.ToDto(paidByOrder.TryGetValue(order.Id, out var paid) ? paid : 0m, createdByName);
    }
}
