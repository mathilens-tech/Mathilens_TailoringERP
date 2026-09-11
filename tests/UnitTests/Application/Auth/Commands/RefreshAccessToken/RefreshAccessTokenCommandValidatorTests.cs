using MathilensERP.Application.Auth.Commands.RefreshAccessToken;

namespace MathilensERP.UnitTests.Application.Auth.Commands.RefreshAccessToken;

public class RefreshAccessTokenCommandValidatorTests
{
    private readonly RefreshAccessTokenCommandValidator _validator = new();

    [Fact]
    public void Validate_WithNonEmptyToken_Passes()
    {
        var result = _validator.Validate(new RefreshAccessTokenCommand("some-refresh-token"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithEmptyToken_Fails()
    {
        var result = _validator.Validate(new RefreshAccessTokenCommand(""));

        Assert.False(result.IsValid);
    }
}
