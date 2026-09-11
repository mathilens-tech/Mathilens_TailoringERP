using MathilensERP.Application.Auth.Commands.Login;

namespace MathilensERP.UnitTests.Application.Auth.Commands.Login;

public class LoginCommandValidatorTests
{
    private readonly LoginCommandValidator _validator = new();

    [Fact]
    public void Validate_WithValidUserNameAndPassword_Passes()
    {
        var result = _validator.Validate(new LoginCommand("radha_owner", "correct-horse-battery-staple"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WithAnEmailAsTheUserName_Passes()
    {
        // Accounts predating usernames hold their email in that field, and this is the rule that
        // decides whether they can still sign in.
        var result = _validator.Validate(new LoginCommand("owner@shop.example", "correct-horse-battery-staple"));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("", "password")]
    [InlineData("asha", "password")]
    [InlineData("radha_owner", "")]
    public void Validate_WithInvalidInput_Fails(string userName, string password)
    {
        var result = _validator.Validate(new LoginCommand(userName, password));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WithAShortUserName_SaysHowShort()
    {
        var result = _validator.Validate(new LoginCommand("asha", "password"));

        // One message, not "required" and "too short" together — the cascade is what keeps a blank
        // field from reporting both.
        var error = Assert.Single(result.Errors);
        Assert.Equal("Username must be at least 5 characters.", error.ErrorMessage);
    }
}
