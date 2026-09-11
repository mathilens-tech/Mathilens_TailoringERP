using MathilensERP.Application.Customers;
using MathilensERP.Application.Customers.Commands.Update;
using MathilensERP.Domain.Customers;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Customers.Commands.Update;

public class UpdateCustomerCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingCustomer_UpdatesAndSavesChanges()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var repository = Substitute.For<ICustomerRepository>();
        repository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        var handler = new UpdateCustomerCommandHandler(repository);
        var command = new UpdateCustomerCommand(customer.Id, "Asha K. Rao", "+91 90000 00000", "asha@example.com", "Address", "Notes");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Asha K. Rao", result.Value.FullName);
        Assert.Equal("+919000000000", result.Value.PhoneNumber);
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownCustomer_ReturnsNotFound()
    {
        var repository = Substitute.For<ICustomerRepository>();
        repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Customer?)null);
        var handler = new UpdateCustomerCommandHandler(repository);
        var command = new UpdateCustomerCommand(Guid.NewGuid(), "Asha Rao", "+91 98765 43210", null, null, null);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Customer.NotFound", result.Error.Code);
        await repository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithPhoneNumberBelongingToAnotherCustomer_ReturnsConflict()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var other = Customer.Create("Ravi Kumar", "+91 90000 00000", null, null, null);
        var repository = Substitute.For<ICustomerRepository>();
        repository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        // Stubbed on the canonical form, because that is what the handler looks up.
        repository.GetByPhoneNumberAsync("+919000000000", Arg.Any<CancellationToken>()).Returns(other);
        var handler = new UpdateCustomerCommandHandler(repository);
        var command = new UpdateCustomerCommand(customer.Id, "Asha Rao", "+91 90000 00000", null, null, null);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Customer.DuplicatePhoneNumber", result.Error.Code);
        await repository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_KeepingItsOwnPhoneNumber_IsNotTreatedAsADuplicate()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var repository = Substitute.For<ICustomerRepository>();
        repository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        // The lookup finds the customer being edited — its own number must not block its own save.
        // Keyed canonically so the stub actually fires; on the raw string it would return null and
        // the test would pass without ever reaching the self-match it exists to cover.
        repository.GetByPhoneNumberAsync("+919876543210", Arg.Any<CancellationToken>()).Returns(customer);
        var handler = new UpdateCustomerCommandHandler(repository);
        var command = new UpdateCustomerCommand(customer.Id, "Asha K. Rao", "+91 98765 43210", null, null, null);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Asha K. Rao", result.Value.FullName);
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
