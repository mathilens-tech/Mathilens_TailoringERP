using MathilensERP.Application.Billing.Queries.Search;

namespace MathilensERP.UnitTests.Application.Billing.Queries.Search;

public class SearchInvoicesQueryValidatorTests
{
    private readonly SearchInvoicesQueryValidator _validator = new();

    [Fact]
    public void Validate_WithValidQuery_Passes()
    {
        var result = _validator.Validate(new SearchInvoicesQuery(null, null, null, null, 1, 20));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void Validate_WithPageSizeOutOfBounds_Fails(int pageSize)
    {
        var result = _validator.Validate(new SearchInvoicesQuery(null, null, null, null, 1, pageSize));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SearchInvoicesQuery.PageSize));
    }

    [Fact]
    public void Validate_WithDateRange_Passes()
    {
        var from = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 8, 14, 0, 0, 0, DateTimeKind.Utc);

        var result = _validator.Validate(new SearchInvoicesQuery(null, null, from, to, 1, 20));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithFromAfterTo_Fails()
    {
        var from = new DateTime(2026, 8, 14, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc);

        var result = _validator.Validate(new SearchInvoicesQuery(null, null, from, to, 1, 20));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SearchInvoicesQuery.FromUtc));
    }

    [Fact]
    public void Validate_WithOnlyOneEndOfTheRange_Passes()
    {
        var from = new DateTime(2026, 8, 14, 0, 0, 0, DateTimeKind.Utc);

        var result = _validator.Validate(new SearchInvoicesQuery(null, null, from, null, 1, 20));

        Assert.True(result.IsValid);
    }
}
