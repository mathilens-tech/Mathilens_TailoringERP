using MathilensERP.Application.Billing;
using MathilensERP.Application.Billing.Commands.Create;
using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Orders;
using MathilensERP.Domain.Billing;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Billing.Commands.Create;

public class CreateInvoiceCommandHandlerTests
{
    /// <summary>A generator that always issues the same reference — these tests are about totals, not numbering.</summary>
    private static IInvoiceNumberGenerator InvoiceNumbers()
    {
        var generator = Substitute.For<IInvoiceNumberGenerator>();
        generator.NextAsync(Arg.Any<CancellationToken>()).Returns("INV-2026-0001");
        return generator;
    }

    [Fact]
    public async Task Handle_WithExistingOrderWithItems_CreatesInvoiceFromOrderTotal()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        order.AddItem(GarmentTypes.Shirt, 2, 500m);
        var orderRepository = Substitute.For<IOrderRepository>();
        orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var invoiceRepository = Substitute.For<IInvoiceRepository>();
        var handler = new CreateInvoiceCommandHandler(invoiceRepository, orderRepository, InvoiceNumbers());

        var result = await handler.Handle(new CreateInvoiceCommand(order.Id, 50m, 0m), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(1000m, result.Value.Subtotal);
        Assert.Equal(1050m, result.Value.TotalAmount);
        Assert.Equal(order.CustomerId, result.Value.CustomerId);
        invoiceRepository.Received(1).Add(Arg.Any<Invoice>());
        await invoiceRepository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownOrder_ReturnsNotFound()
    {
        var orderRepository = Substitute.For<IOrderRepository>();
        orderRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Order?)null);
        var invoiceRepository = Substitute.For<IInvoiceRepository>();
        var handler = new CreateInvoiceCommandHandler(invoiceRepository, orderRepository, InvoiceNumbers());

        var result = await handler.Handle(new CreateInvoiceCommand(Guid.NewGuid(), 0m, 0m), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Order.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_WithOrderWithNoItems_ReturnsConflict()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        var orderRepository = Substitute.For<IOrderRepository>();
        orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var invoiceRepository = Substitute.For<IInvoiceRepository>();
        var handler = new CreateInvoiceCommandHandler(invoiceRepository, orderRepository, InvoiceNumbers());

        var result = await handler.Handle(new CreateInvoiceCommand(order.Id, 0m, 0m), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Order.NoItems", result.Error.Code);
    }

    [Fact]
    public async Task Handle_WithDiscountExceedingTotal_ReturnsConflict()
    {
        var order = Order.Create(Guid.NewGuid(), DateTime.UtcNow, null);
        order.AddItem(GarmentTypes.Shirt, 1, 100m);
        var orderRepository = Substitute.For<IOrderRepository>();
        orderRepository.GetByIdAsync(order.Id, Arg.Any<CancellationToken>()).Returns(order);
        var invoiceRepository = Substitute.For<IInvoiceRepository>();
        var handler = new CreateInvoiceCommandHandler(invoiceRepository, orderRepository, InvoiceNumbers());

        var result = await handler.Handle(new CreateInvoiceCommand(order.Id, 0m, 200m), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Invoice.InvalidTotal", result.Error.Code);
        await invoiceRepository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
