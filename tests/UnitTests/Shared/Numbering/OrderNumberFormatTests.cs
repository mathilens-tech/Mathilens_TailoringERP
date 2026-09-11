using MathilensERP.Shared.Numbering;

namespace MathilensERP.UnitTests.Shared.Numbering;

public class OrderNumberFormatTests
{
    [Theory]
    [InlineData(1, "RFA-1111")]
    [InlineData(2, "RFA-1112")]
    [InlineData(889, "RFA-1999")]
    [InlineData(8889, "RFA-9999")]
    public void Format_WithinTheFirstLetter_CountsFromEleventyOne(long sequenceValue, string expected)
    {
        Assert.Equal(expected, OrderNumberFormat.Format("RF", sequenceValue));
    }

    [Fact]
    public void Format_TheVeryFirstOrder_DoesNotAnnounceItselfAsTheFirst()
    {
        // The whole reason for 1111: a customer reading "RFA-0001" knows they are the shop's first
        // ever order, which is not what a tailor wants a stranger deciding to trust them to see.
        Assert.Equal("RFA-1111", OrderNumberFormat.Format("RF", 1));
    }

    [Fact]
    public void Format_WhenARunIsUsedUp_MovesToTheNextLetterAndStartsAtElevenEleven()
    {
        Assert.Equal("RFA-9999", OrderNumberFormat.Format("RF", OrderNumberFormat.NumbersPerLetter));
        // Not 0001 — the day the letter turns over should not look like a brand new shop either.
        Assert.Equal("RFB-1111", OrderNumberFormat.Format("RF", OrderNumberFormat.NumbersPerLetter + 1));
        Assert.Equal("RFB-1112", OrderNumberFormat.Format("RF", OrderNumberFormat.NumbersPerLetter + 2));
    }

    [Fact]
    public void Format_AcrossSeveralLetters_KeepsTheCountFourDigits()
    {
        Assert.Equal("RFC-1111", OrderNumberFormat.Format("RF", 2 * OrderNumberFormat.NumbersPerLetter + 1));
        Assert.Equal("RFZ-9999", OrderNumberFormat.Format("RF", 26 * OrderNumberFormat.NumbersPerLetter));
    }

    [Fact]
    public void Format_BeyondZ_WidensRatherThanRepeating()
    {
        // 26 letters is 231,114 references, far past this shop. Something still has to come next,
        // and it must not be a reference already handed out.
        Assert.Equal("RFAA-1111", OrderNumberFormat.Format("RF", 26 * OrderNumberFormat.NumbersPerLetter + 1));
    }

    [Theory]
    [InlineData(0, "A")]
    [InlineData(1, "B")]
    [InlineData(25, "Z")]
    [InlineData(26, "AA")]
    [InlineData(27, "AB")]
    [InlineData(51, "AZ")]
    [InlineData(52, "BA")]
    public void LetterFor_CountsLikeSpreadsheetColumns(long block, string expected)
    {
        Assert.Equal(expected, OrderNumberFormat.LetterFor(block));
    }

    [Fact]
    public void Format_UsesWhateverCodeTheShopSet()
    {
        Assert.Equal("MTLA-1111", OrderNumberFormat.Format("MTL", 1));
        Assert.Equal("ORDA-1111", OrderNumberFormat.Format("ORD", 1));
    }

    [Fact]
    public void Format_StaysWithinFourDigitsForEveryValueInARun()
    {
        for (long value = 1; value <= OrderNumberFormat.NumbersPerLetter; value++)
        {
            var count = OrderNumberFormat.Format("RF", value)["RFA-".Length..];
            Assert.Equal(4, count.Length);
        }
    }

    [Fact]
    public void Format_EveryNumberInARunIsDistinct()
    {
        // The rule this whole class exists to keep: one sequence value, one reference, never twice.
        var issued = new HashSet<string>();
        for (long value = 1; value <= 3 * OrderNumberFormat.NumbersPerLetter + 5; value++)
        {
            Assert.True(issued.Add(OrderNumberFormat.Format("RF", value)), $"Repeated at {value}.");
        }
    }

    [Fact]
    public void Format_BelowOne_IsRefused()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => OrderNumberFormat.Format("RF", 0));
    }
}
