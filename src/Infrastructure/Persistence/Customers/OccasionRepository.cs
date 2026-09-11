using MathilensERP.Application.Occasions;
using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Pagination;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.Customers;

/// <summary>
/// Birthdays and anniversaries in a window, joined to whatever follow-up the shop has recorded.
///
/// The awkward part is that the stored date carries the original year, so "in the next 30 days"
/// cannot be a range comparison on it. The occurrence is rebuilt onto the current year and, when
/// that has already passed, onto the next one — which is what makes the window keep working across
/// 31 December. That is done in memory, deliberately: the alternative is date arithmetic inside the
/// query that Npgsql translates into something neither obvious nor indexable, over a table the size
/// of a tailor's customer list.
/// </summary>
public sealed class OccasionRepository : IOccasionRepository
{
    private readonly ApplicationDbContext _db;

    public OccasionRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<OccasionRowDto>> SearchAsync(
        OccasionType occasion,
        OccasionScope scope,
        int windowDays,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Only customers who have the date this report is about. A null one cannot appear in either
        // scope, so it is filtered in the query rather than carried through and dropped later.
        var candidates = await _db.Customers
            .AsNoTracking()
            .Where(c => occasion == OccasionType.Birthday ? c.DateOfBirth != null : c.WeddingDate != null)
            .Select(c => new
            {
                c.Id,
                c.FullName,
                c.PhoneNumber,
                c.Email,
                Source = occasion == OccasionType.Birthday ? c.DateOfBirth!.Value : c.WeddingDate!.Value,
            })
            .ToListAsync(cancellationToken);

        var occurrences = candidates
            .Select(c =>
            {
                var next = AnnualOccurrence.Next(c.Source, today);
                return new
                {
                    c.Id,
                    c.FullName,
                    c.PhoneNumber,
                    c.Email,
                    c.Source,
                    OccasionOn = next,
                    DaysAway = next.DayNumber - today.DayNumber,
                };
            })
            .ToList();

        var customerIds = occurrences.Select(o => o.Id).ToList();

        // Every contact record for the years in play. Two years because a window spanning the New
        // Year holds occurrences from both.
        var years = occurrences.Select(o => o.OccasionOn.Year).Distinct().ToList();
        var contacts = await _db.OccasionContacts
            .AsNoTracking()
            .Where(c => c.Occasion == occasion && customerIds.Contains(c.CustomerId) && years.Contains(c.OccasionYear))
            .Select(c => new { c.CustomerId, c.OccasionYear, c.ContactedOn, c.Remarks })
            .ToListAsync(cancellationToken);

        var contactByKey = contacts.ToDictionary(c => (c.CustomerId, c.OccasionYear));

        var rows = occurrences
            .Select(o =>
            {
                contactByKey.TryGetValue((o.Id, o.OccasionOn.Year), out var contact);
                return new OccasionRowDto(
                    o.Id,
                    o.FullName,
                    o.PhoneNumber,
                    o.Email,
                    o.OccasionOn,
                    o.DaysAway,
                    AnnualOccurrence.YearsCompleted(o.Source, o.OccasionOn),
                    contact is not null,
                    contact?.ContactedOn,
                    contact?.Remarks);
            })
            .Where(row => scope == OccasionScope.Upcoming
                // Still to come inside the window, and not already dealt with — the point of this
                // list is who still needs calling.
                ? row.DaysAway >= 0 && row.DaysAway <= windowDays && !row.IsContacted
                // Contacted recently, whenever the occasion itself falls.
                : row.ContactedOn is not null
                  && row.ContactedOn.Value.DayNumber <= today.DayNumber
                  && today.DayNumber - row.ContactedOn.Value.DayNumber <= windowDays)
            .OrderBy(row => scope == OccasionScope.Upcoming ? row.DaysAway : -(row.ContactedOn!.Value.DayNumber))
            .ThenBy(row => row.FullName)
            .ToList();

        var pageItems = rows.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return new PagedResult<OccasionRowDto>(pageItems, rows.Count, page, pageSize);
    }

    public async Task UpsertContactAsync(RecordOccasionContactDto contact, CancellationToken cancellationToken)
    {
        var existing = await _db.OccasionContacts.FirstOrDefaultAsync(
            c => c.CustomerId == contact.CustomerId
                 && c.Occasion == contact.Occasion
                 && c.OccasionYear == contact.OccasionYear,
            cancellationToken);

        if (existing is null)
        {
            _db.OccasionContacts.Add(OccasionContact.Record(
                contact.CustomerId,
                contact.Occasion,
                contact.OccasionYear,
                contact.ContactedOn,
                contact.Remarks));
        }
        else
        {
            existing.Update(contact.ContactedOn, contact.Remarks);
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

}
