using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Queries.Search;

public sealed class SearchOrdersQueryHandler : IQueryHandler<SearchOrdersQuery, Result<PagedResult<OrderDto>>>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IInvoiceRepository _invoiceRepository;

    public SearchOrdersQueryHandler(IOrderRepository orderRepository, IInvoiceRepository invoiceRepository)
    {
        _orderRepository = orderRepository;
        _invoiceRepository = invoiceRepository;
    }

    public async Task<Result<PagedResult<OrderDto>>> Handle(SearchOrdersQuery query, CancellationToken cancellationToken)
    {
        var page = await _orderRepository.SearchAsync(
            query.CustomerId,
            query.Status,
            query.SearchTerm,
            query.GarmentType,
            query.Page,
            query.PageSize,
            cancellationToken);

        // One billing query for the whole page, not one per row.
        var orderIds = page.Items.Select(o => o.Id).ToList();
        var paidByOrder = await _invoiceRepository.GetPaidAmountsForOrdersAsync(orderIds, cancellationToken);

        // An order with no invoice has genuinely had nothing collected — it was looked up and the
        // answer is zero, which is not the same as the null a command handler leaves behind.
        var items = page.Items
            .Select(o => o.ToDto(paidByOrder.TryGetValue(o.Id, out var paid) ? paid : 0m))
            .ToList();

        return new PagedResult<OrderDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
