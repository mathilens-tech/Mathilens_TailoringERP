using MathilensERP.Application.Customers;
using MathilensERP.Application.Customers.Queries.GetById;
using MathilensERP.Domain.Customers;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Customers.Queries.GetById;

public class GetCustomerByIdQueryHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingCustomer_ReturnsDto()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var repository = Substitute.For<ICustomerRepository>();
        repository.GetByIdAsync(customer.Id, Arg.Any<CancellationToken>()).Returns(customer);
        var handler = new GetCustomerByIdQueryHandler(repository);

        var result = await handler.Handle(new GetCustomerByIdQuery(customer.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(customer.Id, result.Value.Id);
        Assert.Equal("Asha Rao", result.Value.FullName);
    }

    [Fact]
    public async Task Handle_WithUnknownCustomer_ReturnsNotFound()
    {
        var repository = Substitute.For<ICustomerRepository>();
        repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Customer?)null);
        var handler = new GetCustomerByIdQueryHandler(repository);

        var result = await handler.Handle(new GetCustomerByIdQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Customer.NotFound", result.Error.Code);
    }
}
