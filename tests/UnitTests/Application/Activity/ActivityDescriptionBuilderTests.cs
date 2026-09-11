using MathilensERP.Application.Activity;
using MathilensERP.Application.Auth.Commands.Login;
using MathilensERP.Application.Auth.Commands.Register;
using MathilensERP.Application.Customers.Commands.Create;
using MathilensERP.Application.Customers.Commands.Delete;
using MathilensERP.Domain.Customers;

namespace MathilensERP.UnitTests.Application.Activity;

public class ActivityDescriptionBuilderTests
{
    [Fact]
    public void Describe_NamesEachFieldAndItsValue()
    {
        var description = ActivityDescriptionBuilder.Describe(
            new CreateCustomerCommand("Asha Rao", "+91 98765 43210", "asha@example.com", "12 MG Road", null));

        Assert.Contains("Full Name: Asha Rao", description);
        Assert.Contains("Phone Number: +91 98765 43210", description);
        Assert.Contains("Address: 12 MG Road", description);
    }

    [Fact]
    public void Describe_OmitsFieldsThatWereNotSet()
    {
        var description = ActivityDescriptionBuilder.Describe(
            new CreateCustomerCommand("Asha Rao", "+91 98765 43210", null, null, null));

        // An unanswered field says nothing; listing it as empty would only crowd out what was set.
        Assert.DoesNotContain("Email", description);
        Assert.DoesNotContain("Notes", description);
    }

    [Fact]
    public void Describe_RendersEnumsAndDatesReadably()
    {
        var description = ActivityDescriptionBuilder.Describe(new CreateCustomerCommand(
            "Asha Rao", "+91 98765 43210", null, null, null,
            Gender.Female, Religion.Hindu, new DateOnly(1990, 4, 17), null));

        Assert.Contains("Gender: Female", description);
        Assert.Contains("Religion: Hindu", description);
        Assert.Contains("Date Of Birth: 1990-04-17", description);
    }

    [Theory]
    [InlineData("hunter2")]
    [InlineData("P@ssw0rd!")]
    public void Describe_NeverRepeatsAPassword(string password)
    {
        // The trail is written automatically for every command, which makes it exactly the wrong
        // place to end up holding a credential.
        var login = ActivityDescriptionBuilder.Describe(new LoginCommand("asha_rao", password));
        var register = ActivityDescriptionBuilder.Describe(new RegisterCommand("asha@shop.example", password));

        Assert.DoesNotContain(password, login ?? string.Empty, StringComparison.Ordinal);
        Assert.Contains("Password: ●●●●●", login);
        Assert.Contains("Password: ●●●●●", register);
        // The non-secret field is still described.
        Assert.Contains("User Name: asha_rao", login);
    }

    [Fact]
    public void Describe_RedactsRefreshTokensToo()
    {
        var description = ActivityDescriptionBuilder.Describe(
            new MathilensERP.Application.Auth.Commands.RefreshAccessToken.RefreshAccessTokenCommand("a-real-token"));

        Assert.DoesNotContain("a-real-token", description ?? string.Empty, StringComparison.Ordinal);
    }

    [Fact]
    public void Describe_ForADelete_SaysNothingRatherThanQuotingAGuid()
    {
        var id = Guid.NewGuid();

        var description = ActivityDescriptionBuilder.Describe(new DeleteCustomerCommand(id));

        // A delete command carries only the id, and a GUID means nothing to the person reading the
        // trail — "Customer Id: 3f2a9c…" is noise where a name belongs. Which record it was is
        // what the screen and the action already say, so the description stays empty instead.
        Assert.Null(description);
    }

    [Fact]
    public void Describe_WithNoRequest_ReturnsNull()
    {
        Assert.Null(ActivityDescriptionBuilder.Describe(null));
    }

    [Fact]
    public void Describe_TruncatesRatherThanOverflowingTheColumn()
    {
        var description = ActivityDescriptionBuilder.Describe(
            new CreateCustomerCommand("Asha Rao", "+91 98765 43210", null, null, new string('x', 5000)));

        Assert.NotNull(description);
        Assert.True(description!.Length <= 2000, $"Expected at most 2000 characters, got {description.Length}.");
        Assert.EndsWith("…", description);
    }
}
