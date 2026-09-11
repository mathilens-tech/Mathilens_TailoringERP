using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Pagination;

namespace MathilensERP.Application.Occasions;

/// <summary>
/// Birthdays and anniversaries falling inside a window, and the shop's record of following them up.
///
/// Read side is a projection like the other reports — customers joined to whatever contact record
/// exists for this year's occurrence. Write side is a single upsert rather than add/update, because
/// the screen has one control ("Contacted") and pressing it twice is a double-click, not a second
/// conversation.
/// </summary>
public interface IOccasionRepository
{
    /// <param name="windowDays">How far either side of today to look. Upcoming looks forward; Contacted looks back.</param>
    Task<PagedResult<OccasionRowDto>> SearchAsync(
        OccasionType occasion,
        OccasionScope scope,
        int windowDays,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    /// <summary>Records the follow-up, or amends it if this occasion was already marked this year.</summary>
    Task UpsertContactAsync(RecordOccasionContactDto contact, CancellationToken cancellationToken);
}
