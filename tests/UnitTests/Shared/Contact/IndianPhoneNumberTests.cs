using MathilensERP.Shared.Contact;

namespace MathilensERP.UnitTests.Shared.Contact;

public class IndianPhoneNumberTests
{
    /// <summary>
    /// FR-01's own example. The three shapes are the same customer, and the whole point of
    /// normalizing is that the uniqueness check and the spreadsheet import can see that.
    /// </summary>
    [Theory]
    [InlineData("8220070363")]
    [InlineData("918220070363")]
    [InlineData("+918220070363")]
    [InlineData("08220070363")]
    [InlineData("+91 82200-70363")]
    [InlineData("  (91) 8220 070 363  ")]
    public void TryNormalize_WithEveryShapeOfOneNumber_YieldsTheSameValue(string raw)
    {
        Assert.True(IndianPhoneNumber.TryNormalize(raw, out var normalized));
        Assert.Equal("+918220070363", normalized);
    }

    [Fact]
    public void TryNormalize_IsIdempotent()
    {
        Assert.True(IndianPhoneNumber.TryNormalize("8220070363", out var once));
        Assert.True(IndianPhoneNumber.TryNormalize(once, out var twice));

        Assert.Equal(once, twice);
    }

    [Theory]
    [InlineData("994337849")]        // FR-03's example — nine digits.
    [InlineData("98765432101")]      // Eleven, and not a trunk-prefixed one.
    [InlineData("9987654322101")]    // Thirteen.
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not a number")]
    [InlineData("9876543210 / 9876543211")]
    [InlineData("+1 555 123 4567")]  // Valid, but not Indian — guessing +91 onto it would be wrong.
    public void TryNormalize_WithSomethingThatIsNotAnIndianMobileNumber_Fails(string raw)
    {
        Assert.False(IndianPhoneNumber.TryNormalize(raw, out var normalized));
        Assert.Equal(string.Empty, normalized);
    }

    [Fact]
    public void Normalize_WithUnrecognizedInput_KeepsItRatherThanMangleIt()
    {
        Assert.Equal("994337849", IndianPhoneNumber.Normalize("  994337849  "));
    }

    [Theory]
    [InlineData("6220070363")]
    [InlineData("7220070363")]
    [InlineData("8220070363")]
    [InlineData("9220070363")]
    public void IsValid_WithAMobileSeriesNumber_IsTrue(string raw) =>
        Assert.True(IndianPhoneNumber.IsValid(raw));

    [Theory]
    [InlineData("1220070363")]
    [InlineData("5220070363")]
    [InlineData("0220070363")]
    public void IsValid_WithANumberOutsideTheMobileSeries_IsFalse(string raw) =>
        Assert.False(IndianPhoneNumber.IsValid(raw));

    [Fact]
    public void IsValid_WithNineDigits_IsFalse() =>
        Assert.False(IndianPhoneNumber.IsValid("994337849"));
}
