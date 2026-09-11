using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Application.Customers;
using MathilensERP.Application.Customers.Commands.Delete;
using MathilensERP.Application.Orders;
using MathilensERP.Domain.Customers;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Customers.Commands.Delete;

public class DeleteCustomerCommandHandlerTests
{
    private readonly ICustomerRepository _customerRepository = Substitute.For<ICustomerRepository>();
    private readonly IOrderRepository _orderRepository = Substitute.For<IOrderRepository>();
    private readonly ICurrentUserService _currentUserService = Substitute.For<ICurrentUserService>();

    [Fact]
    public async Task Handle_WithExistingCustomer_SoftDeletesAndSavesChanges()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        _customerRepository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        _orderRepository.ExistsForCustomerAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(false);
        var callerId = Guid.NewGuid();
        _currentUserService.UserId.Returns(callerId);
        var handler = new DeleteCustomerCommandHandler(_customerRepository, _orderRepository, _currentUserService);

        var result = await handler.Handle(new DeleteCustomerCommand(customer.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(customer.IsDeleted);
        Assert.Equal(callerId, customer.DeletedBy);
        await _customerRepository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownCustomer_ReturnsNotFound()
    {
        _customerRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Customer?)null);
        var handler = new DeleteCustomerCommandHandler(_customerRepository, _orderRepository, _currentUserService);

        var result = await handler.Handle(new DeleteCustomerCommand(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Customer.NotFound", result.Error.Code);
        await _customerRepository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithAnOrderHistory_RefusesAndLeavesTheCustomerIntact()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        _customerRepository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        _orderRepository.ExistsForCustomerAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new DeleteCustomerCommandHandler(_customerRepository, _orderRepository, _currentUserService);

        var result = await handler.Handle(new DeleteCustomerCommand(customer.Id), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Customer.UsedInOrders", result.Error.Code);
        Assert.Equal("Customer used in Orders.", result.Error.Message);
        Assert.False(customer.IsDeleted);
        await _customerRepository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
