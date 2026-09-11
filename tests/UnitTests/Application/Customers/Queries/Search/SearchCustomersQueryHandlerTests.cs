using MathilensERP.Application.Customers;
using MathilensERP.Application.Customers.Queries.Search;
using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Pagination;
using NSubstitute;

namespace MathilensERP.UnitTests.Application.Customers.Queries.Search;

public class SearchCustomersQueryHandlerTests
{
    [Fact]
    public async Task Handle_MapsPagedCustomersToDtos()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null);
        var repository = Substitute.For<ICustomerRepository>();
        repository.SearchAsync("Asha", null, 1, 20, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<Customer>([customer], 1, 20, 1));
        var handler = new SearchCustomersQueryHandler(repository);

        var result = await handler.Handle(new SearchCustomersQuery("Asha", null, 1, 20), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal(customer.Id, result.Value.Items[0].Id);
        Assert.Equal(1, result.Value.TotalCount);
    }

    [Fact]
    public async Task Handle_PassesTheReligionFilterThrough()
    {
        var customer = Customer.Create("Asha Rao", "+91 98765 43210", null, null, null, religion: Religion.Hindu);
        var repository = Substitute.For<ICustomerRepository>();
        repository.SearchAsync(null, Religion.Hindu, 1, 20, Arg.Any<CancellationToken>())
            .Returns(new PagedResult<Customer>([customer], 1, 20, 1));
        var handler = new SearchCustomersQueryHandler(repository);

        var result = await handler.Handle(new SearchCustomersQuery(null, Religion.Hindu, 1, 20), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(Religion.Hindu, Assert.Single(result.Value.Items).Religion);
        await repository.Received(1).SearchAsync(null, Religion.Hindu, 1, 20, Arg.Any<CancellationToken>());
    }
}
