using MathilensERP.Domain.Customers;

namespace MathilensERP.UnitTests.Domain.Customers;

public class AnnualOccurrenceTests
{
    [Fact]
    public void Next_WhenTheDayIsStillAhead_ReturnsThisYear()
    {
        var next = AnnualOccurrence.Next(new DateOnly(1990, 9, 20), new DateOnly(2026, 8, 13));

        Assert.Equal(new DateOnly(2026, 9, 20), next);
    }

    [Fact]
    public void Next_WhenTheDayHasPassed_RollsToNextYear()
    {
        var next = AnnualOccurrence.Next(new DateOnly(1990, 3, 4), new DateOnly(2026, 8, 13));

        Assert.Equal(new DateOnly(2027, 3, 4), next);
    }

    /// <summary>Today is still to come — a shop's "who do I call today" must include today's birthdays.</summary>
    [Fact]
    public void Next_WhenTheDayIsToday_ReturnsToday()
    {
        var next = AnnualOccurrence.Next(new DateOnly(1990, 8, 13), new DateOnly(2026, 8, 13));

        Assert.Equal(new DateOnly(2026, 8, 13), next);
    }

    /// <summary>The case a 30-day window is most likely to get wrong.</summary>
    [Fact]
    public void Next_InLateDecember_RollsIntoTheFollowingJanuary()
    {
        var next = AnnualOccurrence.Next(new DateOnly(1985, 1, 5), new DateOnly(2026, 12, 28));

        Assert.Equal(new DateOnly(2027, 1, 5), next);
        Assert.Equal(8, next.DayNumber - new DateOnly(2026, 12, 28).DayNumber);
    }

    [Fact]
    public void OnYear_ForALeapDay_FoldsOntoTheTwentyEighthInACommonYear()
    {
        var placed = AnnualOccurrence.OnYear(new DateOnly(2000, 2, 29), 2026);

        Assert.Equal(new DateOnly(2026, 2, 28), placed);
    }

    [Fact]
    public void OnYear_ForALeapDay_KeepsTheTwentyNinthInALeapYear()
    {
        var placed = AnnualOccurrence.OnYear(new DateOnly(2000, 2, 29), 2028);

        Assert.Equal(new DateOnly(2028, 2, 29), placed);
    }

    [Fact]
    public void YearsCompleted_ReturnsTheAgeReached()
    {
        var years = AnnualOccurrence.YearsCompleted(new DateOnly(1990, 9, 20), new DateOnly(2026, 9, 20));

        Assert.Equal(36, years);
    }

    /// <summary>
    /// A shop that only knows the day and month records a placeholder year. Reporting that the
    /// customer is turning 2026 would be worse than saying nothing.
    /// </summary>
    [Fact]
    public void YearsCompleted_WhenTheStoredYearIsAPlaceholder_ReturnsNull()
    {
        var years = AnnualOccurrence.YearsCompleted(new DateOnly(1, 9, 20), new DateOnly(2026, 9, 20));

        Assert.Null(years);
    }
}
