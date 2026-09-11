using MathilensERP.Shared.Contact;

namespace MathilensERP.UnitTests.Shared.Contact;

public class EmailAddressTests
{
    /// <summary>
    /// FR-02's example. This is the address that reached the live customers table, because
    /// FluentValidation's EmailAddress() accepts anything with a single @ in it.
    /// </summary>
    [Fact]
    public void IsValid_WithACommaInPlaceOfTheDot_IsFalse() =>
        Assert.False(EmailAddress.IsValid("kamalesh@gmail,com"));

    [Theory]
    [InlineData("asha@example.com")]
    [InlineData("asha.rao+orders@example.co.in")]
    [InlineData("first_last@example.com")]
    public void IsValid_WithAPlausibleAddress_IsTrue(string value) =>
        Assert.True(EmailAddress.IsValid(value));

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("no@domain")]
    [InlineData("@example.com")]
    [InlineData("spaces in@example.com")]
    [InlineData("two@@example.com")]
    public void IsValid_WithSomethingThatIsNotAnAddress_IsFalse(string value) =>
        Assert.False(EmailAddress.IsValid(value));

    /// <summary>The field is optional — not given is not the same as given wrongly.</summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void IsValid_WithNothingGiven_IsTrue(string? value) =>
        Assert.True(EmailAddress.IsValid(value));
}
