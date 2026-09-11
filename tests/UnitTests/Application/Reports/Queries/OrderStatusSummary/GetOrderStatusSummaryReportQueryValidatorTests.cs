using MathilensERP.Application.Reports.Queries.OrderStatusSummary;

namespace MathilensERP.UnitTests.Application.Reports.Queries.OrderStatusSummary;

public class GetOrderStatusSummaryReportQueryValidatorTests
{
    private readonly GetOrderStatusSummaryReportQueryValidator _validator = new();

    [Fact]
    public void Validate_WithToAfterFrom_Passes()
    {
        var result = _validator.Validate(new GetOrderStatusSummaryReportQuery(DateTime.UtcNow.AddDays(-30), DateTime.UtcNow));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithToBeforeFrom_Fails()
    {
        var result = _validator.Validate(new GetOrderStatusSummaryReportQuery(DateTime.UtcNow, DateTime.UtcNow.AddDays(-30)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(GetOrderStatusSummaryReportQuery.ToUtc));
    }
}
