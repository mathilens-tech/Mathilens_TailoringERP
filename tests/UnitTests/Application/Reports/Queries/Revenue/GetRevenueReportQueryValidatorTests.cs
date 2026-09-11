using MathilensERP.Application.Reports.Queries.Revenue;

namespace MathilensERP.UnitTests.Application.Reports.Queries.Revenue;

public class GetRevenueReportQueryValidatorTests
{
    private readonly GetRevenueReportQueryValidator _validator = new();

    [Fact]
    public void Validate_WithToAfterFrom_Passes()
    {
        var result = _validator.Validate(new GetRevenueReportQuery(DateTime.UtcNow.AddDays(-30), DateTime.UtcNow));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithSameFromAndTo_Passes()
    {
        var now = DateTime.UtcNow;

        var result = _validator.Validate(new GetRevenueReportQuery(now, now));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithToBeforeFrom_Fails()
    {
        var result = _validator.Validate(new GetRevenueReportQuery(DateTime.UtcNow, DateTime.UtcNow.AddDays(-30)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(GetRevenueReportQuery.ToUtc));
    }
}
