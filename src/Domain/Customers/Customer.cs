using MathilensERP.Domain.Common;
using MathilensERP.Shared.Contact;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Customers;

/// <summary>
/// An individual who orders tailoring services from the shop (02_DATABASE.md § 10.3).
/// Anchors a customer's contact details and, once those modules exist, their
/// <c>Measurements</c> and <c>Orders</c> history.
/// </summary>
public sealed class Customer : AuditableEntity
{
    public string FullName { get; private set; } = string.Empty;

    /// <summary>The customer's primary contact method — required (02_DATABASE.md § 10.3
    /// Validation Rules) since the WhatsApp module correlates on it.</summary>
    public string PhoneNumber { get; private set; } = string.Empty;

    public string? Email { get; private set; }

    public string? Address { get; private set; }

    public string? Notes { get; private set; }

    public Gender? Gender { get; private set; }

    public Religion? Religion { get; private set; }

    /// <summary>Date only — the shop greets customers on their birthday, it doesn't need the hour.</summary>
    public DateOnly? DateOfBirth { get; private set; }

    /// <summary>Wedding anniversary. Useful to a tailor: anniversaries drive occasion wear.</summary>
    public DateOnly? WeddingDate { get; private set; }

    private Customer()
    {
        // Reserved for EF Core materialization.
    }

    private Customer(Guid id)
        : base(id)
    {
    }

    public static Customer Create(
        string fullName,
        string phoneNumber,
        string? email,
        string? address,
        string? notes,
        Gender? gender = null,
        Religion? religion = null,
        DateOnly? dateOfBirth = null,
        DateOnly? weddingDate = null)
    {
        var customer = new Customer(Guid.NewGuid());
        customer.SetDetails(fullName, phoneNumber, email, address, notes, gender, religion, dateOfBirth, weddingDate);
        return customer;
    }

    public void UpdateDetails(
        string fullName,
        string phoneNumber,
        string? email,
        string? address,
        string? notes,
        Gender? gender = null,
        Religion? religion = null,
        DateOnly? dateOfBirth = null,
        DateOnly? weddingDate = null) =>
        SetDetails(fullName, phoneNumber, email, address, notes, gender, religion, dateOfBirth, weddingDate);

    private void SetDetails(
        string fullName,
        string phoneNumber,
        string? email,
        string? address,
        string? notes,
        Gender? gender,
        Religion? religion,
        DateOnly? dateOfBirth,
        DateOnly? weddingDate)
    {
        FullName = Guard.AgainstNullOrWhiteSpace(fullName, nameof(fullName));
        // Stored in one canonical form because the number is compared for uniqueness: a trailing
        // space, a hyphen, or a missing country code must not be what makes a second customer
        // "different". Normalizing here rather than only in the handlers makes it structurally
        // impossible for a write path to store some other shape — including one added later.
        //
        // A number that isn't recognized is kept exactly as given rather than mangled toward a
        // shape it never had; the validators reject those before they reach the domain, and the
        // rows already in the table predate the rule.
        PhoneNumber = IndianPhoneNumber.Normalize(
            Guard.AgainstNullOrWhiteSpace(phoneNumber, nameof(phoneNumber)));
        // Blank and absent are the same absence, and only one of them can be compared.
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
        Address = address;
        Notes = notes;
        Gender = gender;
        Religion = religion;
        DateOfBirth = dateOfBirth;
        WeddingDate = weddingDate;
    }
}
