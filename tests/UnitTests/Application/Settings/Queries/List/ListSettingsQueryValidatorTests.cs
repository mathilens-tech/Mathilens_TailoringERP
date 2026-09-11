using MathilensERP.Application.Settings.Queries.List;

namespace MathilensERP.UnitTests.Application.Settings.Queries.List;

public class ListSettingsQueryValidatorTests
{
    private readonly ListSettingsQueryValidator _validator = new();

    [Fact]
    public void Validate_WithValidQuery_Passes()
    {
        var result = _validator.Validate(new ListSettingsQuery(1, 20));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void Validate_WithPageSizeOutOfBounds_Fails(int pageSize)
    {
        var result = _validator.Validate(new ListSettingsQuery(1, pageSize));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(ListSettingsQuery.PageSize));
    }
}
