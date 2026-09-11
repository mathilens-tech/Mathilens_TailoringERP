using MathilensERP.Application.Reports.Queries.OrderCollections;

namespace MathilensERP.UnitTests.Application.Reports.Queries.OrderCollections;

public class GetOrderCollectionsReportQueryValidatorTests
{
    private readonly GetOrderCollectionsReportQueryValidator _validator = new();

    [Fact]
    public void Validate_WithToAfterFrom_Passes()
    {
        var result = _validator.Validate(new GetOrderCollectionsReportQuery(DateTime.UtcNow.AddDays(-30), DateTime.UtcNow));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithSameFromAndTo_Passes()
    {
        var now = DateTime.UtcNow;

        var result = _validator.Validate(new GetOrderCollectionsReportQuery(now, now));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithToBeforeFrom_Fails()
    {
        var result = _validator.Validate(new GetOrderCollectionsReportQuery(DateTime.UtcNow, DateTime.UtcNow.AddDays(-30)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(GetOrderCollectionsReportQuery.ToUtc));
    }
}
