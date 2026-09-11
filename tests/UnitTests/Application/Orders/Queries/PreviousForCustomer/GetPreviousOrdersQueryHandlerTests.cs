using MathilensERP.Application.Billing;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Orders;
using MathilensERP.Application.Orders.Queries.PreviousForCustomer;
using MathilensERP.Domain.Customers;
using MathilensERP.Domain.Orders;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Orders.Queries.PreviousForCustomer;

public class GetPreviousOrdersQueryHandlerTests
{
    private readonly IOrderRepository _orderRepository = Substitute.For<IOrderRepository>();
    private readonly ICustomerRepository _customerRepository = Substitute.For<ICustomerRepository>();
    private readonly IInvoiceRepository _invoiceRepository = Substitute.For<IInvoiceRepository>();

    private GetPreviousOrdersQueryHandler CreateHandler() =>
        new(_orderRepository, _customerRepository, _invoiceRepository);

    [Fact]
    public async Task Handle_LooksUpHistoryByThePhoneNumberNotTheCustomerId()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var order = Order.Create(customer.Id, DateTime.UtcNow, null);
        var earlier = Order.Create(Guid.NewGuid(), DateTime.UtcNow.AddMonths(-2), null);
        _orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        _customerRepository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        _orderRepository.GetByCustomerPhoneAsync("+919876543210", order.Id, Arg.Any<CancellationToken>())
            .Returns([earlier]);
        _invoiceRepository.GetPaidAmountsForOrdersAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal>());

        var result = await CreateHandler().Handle(new GetPreviousOrdersQuery(order.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        // The earlier order sits under a *different* customer id — the same person entered twice.
        Assert.Equal(earlier.Id, Assert.Single(result.Value).Id);
        await _orderRepository.Received(1).GetByCustomerPhoneAsync("+919876543210", order.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownOrder_ReturnsNotFound()
    {
        _orderRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Order?)null);

        var result = await CreateHandler().Handle(new GetPreviousOrdersQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Order.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_WithAMissingCustomerRecord_ReturnsEmptyRatherThanFailing()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        _orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        _customerRepository.GetByIdAsync(order.CustomerId, Arg.Any<CancellationToken>()).Returns((Customer?)null);

        var result = await CreateHandler().Handle(new GetPreviousOrdersQuery(order.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value);
    }
}
