using MathilensERP.Application.Billing;
using MathilensERP.Application.Orders;
using MathilensERP.Application.Orders.Queries.Search;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Pagination;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Orders.Queries.Search;

public class SearchOrdersQueryHandlerTests
{
    private readonly IOrderRepository _orderRepository = Substitute.For<IOrderRepository>();
    private readonly IInvoiceRepository _invoiceRepository = Substitute.For<IInvoiceRepository>();

    [Fact]
    public async Task Handle_MapsPagedOrdersToDtos()
    {
        var customerId = Guid.NewGuid();
        var order = Order.Create(customerId, DateTime.UtcNow, null);
        order.AddItem(GarmentTypes.Shirt, 2, 500m);
        _orderRepository.SearchAsync(customerId, OrderStatus.Received, null, null, 1, 20, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<Order>([order], 1, 20, 1));
        _invoiceRepository.GetPaidAmountsForOrdersAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal> { [order.Id] = 400m });
        var handler = new SearchOrdersQueryHandler(_orderRepository, _invoiceRepository);

        var result = await handler.Handle(new SearchOrdersQuery(customerId, OrderStatus.Received, null, null, 1, 20), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var dto = Assert.Single(result.Value.Items);
        Assert.Equal(order.Id, dto.Id);
        Assert.Equal(1000m, dto.TotalAmount);
        Assert.Equal(400m, dto.AmountPaid);
        Assert.Equal(600m, dto.BalanceAmount);
    }

    [Fact]
    public async Task Handle_WithAnUninvoicedOrder_ReportsNothingCollectedRatherThanUnknown()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        order.AddItem(GarmentTypes.Shirt, 1, 750m);
        _orderRepository.SearchAsync(null, null, null, null, 1, 20, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<Order>([order], 1, 20, 1));
        _invoiceRepository.GetPaidAmountsForOrdersAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal>());
        var handler = new SearchOrdersQueryHandler(_orderRepository, _invoiceRepository);

        var result = await handler.Handle(new SearchOrdersQuery(null, null, null, null, 1, 20), CancellationToken.None);

        var dto = Assert.Single(result.Value.Items);
        Assert.Equal(0m, dto.AmountPaid);
        Assert.Equal(750m, dto.BalanceAmount);
    }

    [Fact]
    public async Task Handle_LooksUpTheWholePageInOneBillingQuery()
    {
        var first = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var second = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        _orderRepository.SearchAsync(null, null, null, null, 1, 20, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<Order>([first, second], 1, 20, 2));
        _invoiceRepository.GetPaidAmountsForOrdersAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal>());
        var handler = new SearchOrdersQueryHandler(_orderRepository, _invoiceRepository);

        await handler.Handle(new SearchOrdersQuery(null, null, null, null, 1, 20), CancellationToken.None);

        await _invoiceRepository.Received(1).GetPaidAmountsForOrdersAsync(
            Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 2), Arg.Any<CancellationToken>());
    }
}
