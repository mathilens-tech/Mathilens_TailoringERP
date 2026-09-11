using MathilensERP.Application.Customers.Queries.Search;

namespace MathilensERP.UnitTests.Application.Customers.Queries.Search;

public class SearchCustomersQueryValidatorTests
{
    private readonly SearchCustomersQueryValidator _validator = new();

    [Fact]
    public void Validate_WithValidQuery_Passes()
    {
        var result = _validator.Validate(new SearchCustomersQuery("Asha", null, 1, 20));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithPageBelowOne_Fails()
    {
        var result = _validator.Validate(new SearchCustomersQuery(null, null, 0, 20));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SearchCustomersQuery.Page));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void Validate_WithPageSizeOutOfBounds_Fails(int pageSize)
    {
        var result = _validator.Validate(new SearchCustomersQuery(null, null, 1, pageSize));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SearchCustomersQuery.PageSize));
    }
}
