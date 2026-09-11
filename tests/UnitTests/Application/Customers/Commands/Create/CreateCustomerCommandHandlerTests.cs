using MathilensERP.Application.Customers;
using MathilensERP.Application.Customers.Commands.Create;
using MathilensERP.Domain.Customers;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Customers.Commands.Create;

public class CreateCustomerCommandHandlerTests
{
    [Fact]
    public async Task Handle_WithValidCommand_AddsCustomerAndSavesChanges()
    {
        var repository = Substitute.For<ICustomerRepository>();
        var handler = new CreateCustomerCommandHandler(repository);
        var command = new CreateCustomerCommand("Asha Rao", "+91 98765 43210", "asha@example.com", "12 MG Road", "Prefers cotton");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Asha Rao", result.Value.FullName);
        // Stored canonically, whatever shape it was typed in (FR-01).
        Assert.Equal("+919876543210", result.Value.PhoneNumber);
        repository.Received(1).Add(Arg.Any<Customer>());
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithPhoneNumberAlreadyUsed_ReturnsConflictAndSavesNothing()
    {
        var existing = Customer.Create("Asha Rao", "+919876543210", null, null, null);
        var repository = Substitute.For<ICustomerRepository>();
        repository.GetByPhoneNumberAsync("+919876543210", Arg.Any<CancellationToken>()).Returns(existing);
        var handler = new CreateCustomerCommandHandler(repository);
        var command = new CreateCustomerCommand("Someone Else", "+919876543210", null, null, null);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Customer.DuplicatePhoneNumber", result.Error.Code);
        // The clash names the customer holding the number, so staff can go straight to them.
        Assert.Contains("Asha Rao", result.Error.Message);
        repository.DidNotReceive().Add(Arg.Any<Customer>());
        await repository.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// The reason normalizing is worth doing at all: before it, typing an existing customer's
    /// number in any other shape sailed past the uniqueness check and created a second record
    /// for the same person.
    /// </summary>
    [Theory]
    [InlineData("8220070363")]
    [InlineData("918220070363")]
    [InlineData("+91 82200-70363")]
    [InlineData("08220070363")]
    public async Task Handle_WithAnExistingNumberTypedInAnotherShape_StillDetectsTheDuplicate(string typed)
    {
        var existing = Customer.Create("Asha Rao", "+918220070363", null, null, null);
        var repository = Substitute.For<ICustomerRepository>();
        repository.GetByPhoneNumberAsync("+918220070363", Arg.Any<CancellationToken>()).Returns(existing);
        var handler = new CreateCustomerCommandHandler(repository);

        var result = await handler.Handle(
            new CreateCustomerCommand("Someone Else", typed, null, null, null), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Customer.DuplicatePhoneNumber", result.Error.Code);
        repository.DidNotReceive().Add(Arg.Any<Customer>());
    }
}
