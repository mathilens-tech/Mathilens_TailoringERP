using MathilensERP.Application.Employees.Queries.Search;

namespace MathilensERP.UnitTests.Application.Employees.Queries.Search;

public class SearchEmployeesQueryValidatorTests
{
    private readonly SearchEmployeesQueryValidator _validator = new();

    [Fact]
    public void Validate_WithValidQuery_Passes()
    {
        var result = _validator.Validate(new SearchEmployeesQuery("Ravi", 1, 20));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithPageBelowOne_Fails()
    {
        var result = _validator.Validate(new SearchEmployeesQuery(null, 0, 20));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SearchEmployeesQuery.Page));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void Validate_WithPageSizeOutOfBounds_Fails(int pageSize)
    {
        var result = _validator.Validate(new SearchEmployeesQuery(null, 1, pageSize));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SearchEmployeesQuery.PageSize));
    }
}
