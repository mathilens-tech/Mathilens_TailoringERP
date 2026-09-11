using MathilensERP.Application.Orders.Queries.Search;
using MathilensERP.Domain.Orders;

namespace MathilensERP.UnitTests.Application.Orders.Queries.Search;

public class SearchOrdersQueryValidatorTests
{
    private readonly SearchOrdersQueryValidator _validator = new();

    [Fact]
    public void Validate_WithValidQuery_Passes()
    {
        var result = _validator.Validate(new SearchOrdersQuery(Guid.NewGuid(), OrderStatus.Received, null, null, 1, 20));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithNoFilters_Passes()
    {
        var result = _validator.Validate(new SearchOrdersQuery(null, null, null, null, 1, 20));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void Validate_WithPageSizeOutOfBounds_Fails(int pageSize)
    {
        var result = _validator.Validate(new SearchOrdersQuery(null, null, null, null, 1, pageSize));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SearchOrdersQuery.PageSize));
    }
}
