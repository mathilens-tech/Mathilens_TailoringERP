using MathilensERP.Domain.Customers;

namespace MathilensERP.Application.Occasions;

/// <summary>Which set of occurrences a screen is asking for.</summary>
public enum OccasionScope
{
    /// <summary>Occurrences still to come inside the window — who to call.</summary>
    Upcoming = 0,

    /// <summary>Occurrences already contacted inside the window — what was said, and what came of it.</summary>
    Contacted = 1,
}

/// <summary>
/// One customer's occasion in the window being viewed.
///
/// <see cref="OccasionOn"/> is this year's occurrence, not the stored date of birth or wedding
/// date: a report about who to call in the next 30 days is answering a question about this year,
/// and returning the original 1987 date would leave the screen to recompute it.
/// </summary>
public sealed record OccasionRowDto(
    Guid CustomerId,
    string FullName,
    string PhoneNumber,
    string? Email,
    DateOnly OccasionOn,
    /// <summary>Negative when the occasion has already passed inside the window.</summary>
    int DaysAway,
    /// <summary>How old they turn, or which anniversary it is. Null when the stored year is unknown.</summary>
    int? YearsCompleted,
    bool IsContacted,
    DateOnly? ContactedOn,
    string? Remarks);

/// <summary>What a screen sends to mark an occasion as followed up, or to amend the remarks.</summary>
public sealed record RecordOccasionContactDto(
    Guid CustomerId,
    OccasionType Occasion,
    int OccasionYear,
    DateOnly ContactedOn,
    string? Remarks);
