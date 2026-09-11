using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Customers;

/// <summary>Which yearly occasion a customer was contacted about.</summary>
public enum OccasionType
{
    Birthday = 1,
    WeddingAnniversary = 2,
}

/// <summary>
/// A record that the shop reached out to a customer about a birthday or anniversary, and what came
/// of it.
///
/// Scoped to a single occurrence rather than to the customer: <see cref="OccasionYear"/> is what
/// stops last year's call marking this year's birthday as already handled. A customer accumulates
/// one row per occasion per year, which is also the history a shop wants — "we called last year and
/// they ordered a sherwani" is worth more than a flag.
///
/// The occasion date itself is not stored here. It lives on the customer, and copying it would let
/// the two disagree the moment a date of birth is corrected.
/// </summary>
public sealed class OccasionContact : AuditableEntity
{
    private OccasionContact() { }

    public Guid CustomerId { get; private set; }

    public OccasionType Occasion { get; private set; }

    /// <summary>The calendar year of the occurrence this contact was about.</summary>
    public int OccasionYear { get; private set; }

    /// <summary>When the shop made contact. Supplied rather than inferred, so a call logged the next morning keeps the day it happened.</summary>
    public DateOnly ContactedOn { get; private set; }

    /// <summary>What was said, or what they ordered. Free text — this is the part the shop actually reads next year.</summary>
    public string? Remarks { get; private set; }

    public static OccasionContact Record(
        Guid customerId,
        OccasionType occasion,
        int occasionYear,
        DateOnly contactedOn,
        string? remarks)
    {
        Guard.AgainstEmpty(customerId, nameof(customerId));

        // A four-digit year, and not one so far out that it can only be a typo. Nothing here is
        // worth a lookup table; the point is to reject 202 and 20260 before they reach the index.
        Guard.AgainstOutOfRange(occasionYear, 2000, 2200, nameof(occasionYear));

        return new OccasionContact
        {
            CustomerId = customerId,
            Occasion = occasion,
            OccasionYear = occasionYear,
            ContactedOn = contactedOn,
            Remarks = Normalize(remarks),
        };
    }

    /// <summary>Amend an existing record — the remarks are what change, once the customer replies.</summary>
    public void Update(DateOnly contactedOn, string? remarks)
    {
        ContactedOn = contactedOn;
        Remarks = Normalize(remarks);
    }

    private static string? Normalize(string? remarks) =>
        string.IsNullOrWhiteSpace(remarks) ? null : remarks.Trim();
}
