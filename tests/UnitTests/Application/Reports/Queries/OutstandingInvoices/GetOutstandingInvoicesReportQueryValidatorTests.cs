using MathilensERP.Application.Reports.Queries.OutstandingInvoices;

namespace MathilensERP.UnitTests.Application.Reports.Queries.OutstandingInvoices;

public class GetOutstandingInvoicesReportQueryValidatorTests
{
    private readonly GetOutstandingInvoicesReportQueryValidator _validator = new();

    [Fact]
    public void Validate_WithValidQuery_Passes()
    {
        var result = _validator.Validate(new GetOutstandingInvoicesReportQuery(1, 20));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void Validate_WithPageSizeOutOfBounds_Fails(int pageSize)
    {
        var result = _validator.Validate(new GetOutstandingInvoicesReportQuery(1, pageSize));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(GetOutstandingInvoicesReportQuery.PageSize));
    }
}
