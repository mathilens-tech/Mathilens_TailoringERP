namespace MathilensERP.Domain.Customers;

/// <summary>
/// When a yearly date next comes round.
///
/// A birthday or anniversary is stored with the year it originally happened, so "in the next thirty
/// days" cannot be a comparison against the stored value. The occurrence has to be rebuilt onto the
/// year in question first, which is what this does.
/// </summary>
public static class AnnualOccurrence
{
    /// <summary>
    /// This year's occurrence of a day and month, or next year's if it has already gone by.
    ///
    /// Today counts as still to come: a shop looking at "who do I call today" wants today's
    /// birthdays in that list, not pushed a year out.
    /// </summary>
    public static DateOnly Next(DateOnly source, DateOnly today)
    {
        var thisYear = OnYear(source, today.Year);
        return thisYear.DayNumber >= today.DayNumber ? thisYear : OnYear(source, today.Year + 1);
    }

    /// <summary>
    /// The same day and month placed on a given year.
    ///
    /// 29 February folds onto the 28th in a common year rather than being skipped — a shop calling
    /// its customers wants the reminder every year, not three years in four.
    /// </summary>
    public static DateOnly OnYear(DateOnly source, int year)
    {
        var day = Math.Min(source.Day, DateTime.DaysInMonth(year, source.Month));
        return new DateOnly(year, source.Month, day);
    }

    /// <summary>
    /// How many years the occurrence completes, or null when the stored year cannot be meant
    /// literally.
    ///
    /// A shop that only knows the day and month often records a placeholder year; reporting that a
    /// customer is turning 2026 helps nobody, so it says nothing instead.
    /// </summary>
    public static int? YearsCompleted(DateOnly source, DateOnly occurrence) =>
        source.Year > 1900 ? occurrence.Year - source.Year : null;
}
