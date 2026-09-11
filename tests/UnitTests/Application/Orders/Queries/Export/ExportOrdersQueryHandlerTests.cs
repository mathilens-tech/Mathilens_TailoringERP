using MathilensERP.Application.Billing;
using MathilensERP.Application.Orders;
using MathilensERP.Application.Orders.Queries.Export;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Pagination;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Orders.Queries.Export;

public class ExportOrdersQueryHandlerTests
{
    private readonly IOrderRepository _orderRepository = Substitute.For<IOrderRepository>();
    private readonly IInvoiceRepository _invoiceRepository = Substitute.For<IInvoiceRepository>();

    [Fact]
    public async Task Handle_ReturnsTheFilteredOrdersWithTheirCollectedAmounts()
    {
        var customerId = Guid.NewGuid();
        var order = Order.Create(customerId, DateTime.UtcNow, null);
        order.AddItem(GarmentTypes.Shirt, 2, 500m);
        _orderRepository.SearchAsync(customerId, OrderStatus.Received, "MTL-0001", null, 1, 5000, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<Order>([order], 1, 5000, 1));
        _invoiceRepository.GetPaidAmountsForOrdersAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal> { [order.Id] = 400m });
        var handler = new ExportOrdersQueryHandler(_orderRepository, _invoiceRepository);

        var result = await handler.Handle(
            new ExportOrdersQuery(customerId, OrderStatus.Received, "MTL-0001", null),
            CancellationToken.None);

        var dto = Assert.Single(result.Value);
        Assert.Equal(400m, dto.AmountPaid);
        Assert.Equal(600m, dto.BalanceAmount);
        await _invoiceRepository.Received(1).GetPaidAmountsForOrdersAsync(
            Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 1 && ids.Contains(order.Id)), Arg.Any<CancellationToken>());
    }
}
