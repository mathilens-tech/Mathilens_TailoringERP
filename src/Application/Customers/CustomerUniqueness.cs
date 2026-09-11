using MathilensERP.Shared.Contact;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers;

/// <summary>
/// The "one phone, one email, one person" rule, shared by the create and update handlers so the
/// two can't drift apart — the same reasoning as <c>EmployeeUniqueness</c>. Returns the
/// <see cref="Error"/> to fail with, or <c>null</c> when the details are free to use.
/// </summary>
internal static class CustomerUniqueness
{
    public static async Task<Error?> FindConflictAsync(
        ICustomerRepository customerRepository,
        string phoneNumber,
        string? email,
        Guid? excludeId,
        CancellationToken cancellationToken)
    {
        // Compared in canonical form, not as typed. The stored numbers are all +91XXXXXXXXXX, so
        // looking up the raw "8220070363" would find nothing and happily create the duplicate this
        // check exists to prevent.
        var canonical = IndianPhoneNumber.Normalize(phoneNumber);

        // The phone number identifies a customer at the counter and is what the WhatsApp module
        // and spreadsheet import both correlate on — two customers sharing one would make all
        // three ambiguous. Soft-deleted customers are outside the query filter, so a number
        // belonging only to a deleted record is free to reuse.
        var byPhone = await customerRepository.GetByPhoneNumberAsync(canonical, cancellationToken);
        if (byPhone is not null && byPhone.Id != excludeId)
        {
            return Error.Conflict(
                "Customer.DuplicatePhoneNumber",
                // Quoted as the ten digits the operator typed. The stored form carries a country
                // code they never entered, and a message naming a number they do not recognize
                // reads as being about somebody else's record.
                $"A customer with mobile number '{IndianPhoneNumber.ToDisplay(canonical)}' already exists ({byPhone.FullName}).");
        }

        // Email is optional, and blank is not a value two customers can collide on — several
        // customers having no address on file is the ordinary state of a shop's books.
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var address = email.Trim();
        var byEmail = await customerRepository.GetByEmailAsync(address, cancellationToken);
        if (byEmail is not null && byEmail.Id != excludeId)
        {
            return Error.Conflict(
                "Customer.DuplicateEmail",
                $"A customer with email '{address}' already exists ({byEmail.FullName}).");
        }

        return null;
    }
}
