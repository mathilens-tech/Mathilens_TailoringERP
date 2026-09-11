using MathilensERP.Shared.Guards;

namespace MathilensERP.UnitTests.Shared;

public class GuardTests
{
    [Fact]
    public void AgainstNull_WithNonNullValue_ReturnsValue()
    {
        var value = Guard.AgainstNull("hello", "value");

        Assert.Equal("hello", value);
    }

    [Fact]
    public void AgainstNull_WithNullValue_Throws()
    {
        Assert.Throws<ArgumentNullException>(() => Guard.AgainstNull<string>(null, "value"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void AgainstNullOrWhiteSpace_WithBlankValue_Throws(string? value)
    {
        Assert.Throws<ArgumentException>(() => Guard.AgainstNullOrWhiteSpace(value, "value"));
    }

    [Fact]
    public void AgainstNullOrWhiteSpace_WithValidValue_ReturnsValue()
    {
        var value = Guard.AgainstNullOrWhiteSpace("shop name", "value");

        Assert.Equal("shop name", value);
    }

    [Fact]
    public void AgainstEmpty_WithEmptyGuid_Throws()
    {
        Assert.Throws<ArgumentException>(() => Guard.AgainstEmpty(Guid.Empty, "value"));
    }

    [Fact]
    public void AgainstEmpty_WithNonEmptyGuid_ReturnsValue()
    {
        var id = Guid.NewGuid();

        var result = Guard.AgainstEmpty(id, "value");

        Assert.Equal(id, result);
    }

    [Fact]
    public void AgainstNegative_WithNegativeValue_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Guard.AgainstNegative(-1, "value"));
    }

    [Fact]
    public void AgainstNegative_WithZeroOrPositiveValue_ReturnsValue()
    {
        Assert.Equal(0, Guard.AgainstNegative(0, "value"));
        Assert.Equal(5, Guard.AgainstNegative(5, "value"));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void AgainstNegativeOrZero_WithNonPositiveValue_Throws(decimal value)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Guard.AgainstNegativeOrZero(value, "value"));
    }

    [Fact]
    public void AgainstOutOfRange_WithValueOutsideBounds_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Guard.AgainstOutOfRange(101, 1, 100, "value"));
    }

    [Fact]
    public void AgainstOutOfRange_WithValueWithinBounds_ReturnsValue()
    {
        var result = Guard.AgainstOutOfRange(50, 1, 100, "value");

        Assert.Equal(50, result);
    }
}
