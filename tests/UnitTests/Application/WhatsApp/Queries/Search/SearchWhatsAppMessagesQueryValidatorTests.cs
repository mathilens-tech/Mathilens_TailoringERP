using MathilensERP.Application.WhatsApp.Queries.Search;

namespace MathilensERP.UnitTests.Application.WhatsApp.Queries.Search;

public class SearchWhatsAppMessagesQueryValidatorTests
{
    private readonly SearchWhatsAppMessagesQueryValidator _validator = new();

    [Fact]
    public void Validate_WithValidQuery_Passes()
    {
        var result = _validator.Validate(new SearchWhatsAppMessagesQuery(null, null, null, 1, 20));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void Validate_WithPageSizeOutOfBounds_Fails(int pageSize)
    {
        var result = _validator.Validate(new SearchWhatsAppMessagesQuery(null, null, null, 1, pageSize));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SearchWhatsAppMessagesQuery.PageSize));
    }
}
