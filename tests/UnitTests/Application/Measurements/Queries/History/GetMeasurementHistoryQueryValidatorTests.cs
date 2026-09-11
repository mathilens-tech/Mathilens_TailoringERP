using MathilensERP.Application.Measurements.Queries.History;

namespace MathilensERP.UnitTests.Application.Measurements.Queries.History;

public class GetMeasurementHistoryQueryValidatorTests
{
    private readonly GetMeasurementHistoryQueryValidator _validator = new();

    [Fact]
    public void Validate_WithValidQuery_Passes()
    {
        var result = _validator.Validate(new GetMeasurementHistoryQuery(Guid.NewGuid(), 1, 20));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithEmptyMeasurementId_Fails()
    {
        var result = _validator.Validate(new GetMeasurementHistoryQuery(Guid.Empty, 1, 20));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(GetMeasurementHistoryQuery.MeasurementId));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void Validate_WithPageSizeOutOfBounds_Fails(int pageSize)
    {
        var result = _validator.Validate(new GetMeasurementHistoryQuery(Guid.NewGuid(), 1, pageSize));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(GetMeasurementHistoryQuery.PageSize));
    }
}
