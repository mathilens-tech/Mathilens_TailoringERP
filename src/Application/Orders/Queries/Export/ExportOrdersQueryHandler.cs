using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Queries.Export;

public sealed class ExportOrdersQueryHandler : IQueryHandler<ExportOrdersQuery, Result<IReadOnlyList<OrderDto>>>
{
    /// <summary>Large enough for a shop's working history, while keeping a single download bounded.</summary>
    private const int ExportPageSize = 5000;

    private readonly IOrderRepository _orderRepository;
    private readonly IInvoiceRepository _invoiceRepository;

    public ExportOrdersQueryHandler(IOrderRepository orderRepository, IInvoiceRepository invoiceRepository)
    {
        _orderRepository = orderRepository;
        _invoiceRepository = invoiceRepository;
    }

    public async Task<Result<IReadOnlyList<OrderDto>>> Handle(ExportOrdersQuery query, CancellationToken cancellationToken)
    {
        var page = await _orderRepository.SearchAsync(
            query.CustomerId, query.Status, query.SearchTerm, query.GarmentType, 1, ExportPageSize, cancellationToken);

        // Like the list view, look billing up once for the complete export instead of once per order.
        var paidByOrder = await _invoiceRepository.GetPaidAmountsForOrdersAsync(
            page.Items.Select(order => order.Id).ToList(), cancellationToken);

        return page.Items
            .Select(order => order.ToDto(paidByOrder.TryGetValue(order.Id, out var paid) ? paid : 0m))
            .ToList();
    }
}
