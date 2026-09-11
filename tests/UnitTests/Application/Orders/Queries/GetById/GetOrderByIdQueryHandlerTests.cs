using MathilensERP.Application.Billing;
using MathilensERP.Application.Orders;
using MathilensERP.Application.Orders.Queries.GetById;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Orders.Queries.GetById;

public class GetOrderByIdQueryHandlerTests
{
    private readonly IOrderRepository _orderRepository = Substitute.For<IOrderRepository>();
    private readonly IInvoiceRepository _invoiceRepository = Substitute.For<IInvoiceRepository>();

    [Fact]
    public async Task Handle_WithExistingOrder_ReturnsDto()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        order.AddItem(GarmentTypes.Shirt, 3, 250m);
        _orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        _invoiceRepository.GetPaidAmountsForOrdersAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal> { [order.Id] = 300m });
        var handler = new GetOrderByIdQueryHandler(_orderRepository, _invoiceRepository);

        var result = await handler.Handle(new GetOrderByIdQuery(order.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(order.Id, result.Value.Id);
        Assert.Equal(750m, result.Value.TotalAmount);
        Assert.Equal(300m, result.Value.AmountPaid);
        Assert.Equal(450m, result.Value.BalanceAmount);
    }

    [Fact]
    public async Task Handle_WithUnknownOrder_ReturnsNotFound()
    {
        _orderRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Order?)null);
        var handler = new GetOrderByIdQueryHandler(_orderRepository, _invoiceRepository);

        var result = await handler.Handle(new GetOrderByIdQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Order.NotFound", result.Error.Code);
        await _invoiceRepository.DidNotReceive().GetPaidAmountsForOrdersAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
    }
}
