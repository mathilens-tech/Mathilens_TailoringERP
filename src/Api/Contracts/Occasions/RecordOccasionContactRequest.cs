using MathilensERP.Domain.Customers;

namespace MathilensERP.Api.Contracts.Occasions;

/// <summary>
/// Marks a birthday or anniversary as followed up, or amends the remarks.
///
/// The year is sent by the caller rather than inferred from today: a call logged on 2 January about
/// a 30 December birthday belongs to the old year's occurrence, and guessing here would file it
/// against the wrong one.
/// </summary>
public sealed record RecordOccasionContactRequest(
    Guid CustomerId,
    OccasionType Occasion,
    int OccasionYear,
    DateOnly ContactedOn,
    string? Remarks);
