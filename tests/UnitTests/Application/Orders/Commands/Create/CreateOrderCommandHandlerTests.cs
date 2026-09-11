using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Employees;
using MathilensERP.Application.Orders;
using MathilensERP.Application.Orders.Commands.Create;
using MathilensERP.Application.Pricing;
using MathilensERP.Domain.Customers;
using MathilensERP.Domain.Employees;
using MathilensERP.Domain.Measurements;
using MathilensERP.Domain.Orders;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Orders.Commands.Create;

public class CreateOrderCommandHandlerTests
{
    private static readonly IReadOnlyList<CreateOrderItemInput> OneItem =
        [new CreateOrderItemInput(GarmentTypes.Shirt, 1, 500m, new CreateOrderItemFabricInput("Cotton", FabricSource.ShopSupplied, "Blue", 2m))];

    /// <summary>
    /// A fixed number, because these tests are about what the handler builds rather than how the
    /// number is arrived at — the sequence that guarantees uniqueness lives in the database and is
    /// not something a substitute can stand in for meaningfully.
    /// </summary>
    private static IOrderNumberGenerator OrderNumbers()
    {
        var generator = Substitute.For<IOrderNumberGenerator>();
        generator.NextAsync(Arg.Any<CancellationToken>()).Returns("MTL-0001");
        return generator;
    }

    [Fact]
    public async Task Handle_PutsTheIssuedNumberOnTheOrder()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var customerRepository = Substitute.For<ICustomerRepository>();
        customerRepository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        var orderRepository = Substitute.For<IOrderRepository>();
        var handler = new CreateOrderCommandHandler(
            orderRepository,
            customerRepository,
            Substitute.For<IEmployeeRepository>(),
            Substitute.For<IClothPriceRepository>(),
            OrderNumbers());

        var result = await handler.Handle(
            new CreateOrderCommand(customer.Id, null, DateTime.UtcNow.AddDays(7), OneItem),
            CancellationToken.None);

        // Both the saved aggregate and the response, because the shop reads the number off the
        // screen it lands on and then off the job card printed from the stored record.
        Assert.Equal("MTL-0001", result.Value.OrderNumber);
        orderRepository.Received(1).Add(Arg.Is<Order>(o => o.OrderNumber == "MTL-0001"));
    }

    [Fact]
    public async Task Handle_WithMissingCustomer_DoesNotSpendANumber()
    {
        var customerRepository = Substitute.For<ICustomerRepository>();
        customerRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Customer?)null);
        var orderNumbers = OrderNumbers();
        var handler = new CreateOrderCommandHandler(
            Substitute.For<IOrderRepository>(),
            customerRepository,
            Substitute.For<IEmployeeRepository>(),
            Substitute.For<IClothPriceRepository>(),
            orderNumbers);

        var result = await handler.Handle(
            new CreateOrderCommand(Guid.NewGuid(), null, DateTime.UtcNow.AddDays(7), OneItem),
            CancellationToken.None);

        // A number taken is a number gone — the sequence never hands it back. Checking the request
        // first means a mistyped customer does not leave a hole in the shop's numbering.
        Assert.True(result.IsFailure);
        await orderNumbers.DidNotReceive().NextAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithExistingCustomer_CreatesOrderWithItemsAndFabric()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var customerRepository = Substitute.For<ICustomerRepository>();
        customerRepository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        var employeeRepository = Substitute.For<IEmployeeRepository>();
        var orderRepository = Substitute.For<IOrderRepository>();
        var handler = new CreateOrderCommandHandler(
            orderRepository, customerRepository, employeeRepository, Substitute.For<IClothPriceRepository>(), OrderNumbers());
        var dueAtUtc = DateTime.UtcNow.AddDays(7);

        var result = await handler.Handle(new CreateOrderCommand(customer.Id, null, dueAtUtc, OneItem), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(customer.Id, result.Value.CustomerId);
        Assert.Single(result.Value.Items);
        Assert.NotNull(result.Value.Items[0].Fabric);
        Assert.Equal("Cotton", result.Value.Items[0].Fabric!.FabricType);
        orderRepository.Received(1).Add(Arg.Any<Order>());
        await orderRepository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownCustomer_ReturnsNotFound()
    {
        var customerRepository = Substitute.For<ICustomerRepository>();
        customerRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Customer?)null);
        var employeeRepository = Substitute.For<IEmployeeRepository>();
        var orderRepository = Substitute.For<IOrderRepository>();
        var handler = new CreateOrderCommandHandler(
            orderRepository, customerRepository, employeeRepository, Substitute.For<IClothPriceRepository>(), OrderNumbers());

        var result = await handler.Handle(new CreateOrderCommand(Guid.NewGuid(), null, DateTime.UtcNow, OneItem), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Customer.NotFound", result.Error.Code);
        await orderRepository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownEmployee_ReturnsNotFound()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var customerRepository = Substitute.For<ICustomerRepository>();
        customerRepository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        var employeeRepository = Substitute.For<IEmployeeRepository>();
        employeeRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Employee?)null);
        var orderRepository = Substitute.For<IOrderRepository>();
        var handler = new CreateOrderCommandHandler(
            orderRepository, customerRepository, employeeRepository, Substitute.For<IClothPriceRepository>(), OrderNumbers());

        var result = await handler.Handle(
            new CreateOrderCommand(customer.Id, Guid.NewGuid(), DateTime.UtcNow, OneItem), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Employee.NotFound", result.Error.Code);
        await orderRepository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
