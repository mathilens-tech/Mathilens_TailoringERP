using MathilensERP.Application.Billing;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Queries.PreviousForCustomer;

/// <summary>
/// The rest of this customer's order history, shown alongside an order so staff can see what the
/// shop has made for them before.
///
/// Matched on the customer's <em>phone number</em> rather than their id: the same person is
/// regularly entered twice at a busy counter — once as "Asha", once as "Asha Rao" — and history
/// split across those records is history the shop can't see. The phone is what staff actually key
/// on, and it is already this system's natural key for a person (it's what spreadsheet imports
/// upsert against, and what WhatsApp correlates on).
/// </summary>
public sealed class GetPreviousOrdersQueryHandler : IQueryHandler<GetPreviousOrdersQuery, Result<IReadOnlyList<OrderDto>>>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ICustomerRepository _customerRepository;
    private readonly IInvoiceRepository _invoiceRepository;

    public GetPreviousOrdersQueryHandler(
        IOrderRepository orderRepository,
        ICustomerRepository customerRepository,
        IInvoiceRepository invoiceRepository)
    {
        _orderRepository = orderRepository;
        _customerRepository = customerRepository;
        _invoiceRepository = invoiceRepository;
    }

    public async Task<Result<IReadOnlyList<OrderDto>>> Handle(GetPreviousOrdersQuery query, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdAsync(query.OrderId, cancellationToken);
        if (order is null)
        {
            return Result.Failure<IReadOnlyList<OrderDto>>(
                Error.NotFound("Order.NotFound", $"No order was found with id '{query.OrderId}'."));
        }

        var customer = await _customerRepository.GetByIdAsync(order.CustomerId, cancellationToken);
        if (customer is null)
        {
            // The order outlives a deleted customer record, and a missing one is no reason to fail
            // the page — there is simply no phone number left to match a history on.
            return Result.Success<IReadOnlyList<OrderDto>>([]);
        }

        var previous = await _orderRepository.GetByCustomerPhoneAsync(customer.PhoneNumber, order.Id, cancellationToken);

        var paidByOrder = await _invoiceRepository.GetPaidAmountsForOrdersAsync(
            previous.Select(o => o.Id).ToList(), cancellationToken);

        var items = previous
            .Select(o => o.ToDto(paidByOrder.TryGetValue(o.Id, out var paid) ? paid : 0m))
            .ToList();

        return Result.Success<IReadOnlyList<OrderDto>>(items);
    }
}
