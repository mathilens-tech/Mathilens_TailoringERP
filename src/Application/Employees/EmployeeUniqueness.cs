using MathilensERP.Shared.Contact;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Employees;

/// <summary>
/// The "one code, one phone, one person" rule, shared by the create and update handlers so the
/// two can't drift apart. Returns the <see cref="Error"/> to fail with, or <c>null</c> when the
/// details are free to use.
/// </summary>
internal static class EmployeeUniqueness
{
    public static async Task<Error?> FindConflictAsync(
        IEmployeeRepository employeeRepository,
        string employeeCode,
        string phoneNumber,
        string? email,
        Guid? excludeId,
        CancellationToken cancellationToken)
    {
        var code = employeeCode?.Trim() ?? string.Empty;
        if (code.Length > 0)
        {
            var byCode = await employeeRepository.GetByEmployeeCodeAsync(code, cancellationToken);
            if (byCode is not null && byCode.Id != excludeId)
            {
                return Error.Conflict(
                    "Employee.DuplicateEmployeeCode",
                    $"Employee code '{code}' is already used by {byCode.FullName}.");
            }
        }

        // Blank only reaches here from an import row the validator already rejected; there is
        // nothing to compare, and the row's own error is the useful one.
        if (string.IsNullOrWhiteSpace(phoneNumber))
        {
            return null;
        }

        // Compared in canonical form, not as typed. Stored numbers are all +91XXXXXXXXXX, so
        // looking up a raw "8220070363" would find nothing and let the duplicate through — which
        // is the one thing this method exists to stop. Normalizing here covers the create and
        // update handlers and the spreadsheet import, since all three ask through here.
        var canonical = IndianPhoneNumber.Normalize(phoneNumber);

        var byPhone = await employeeRepository.GetByPhoneNumberAsync(canonical, cancellationToken);
        if (byPhone is not null && byPhone.Id != excludeId)
        {
            return Error.Conflict(
                "Employee.DuplicatePhoneNumber",
                // Quoted as the ten digits that were typed, not the stored canonical form — a
                // message naming a number the operator does not recognize reads as being about
                // somebody else's record.
                $"An employee with mobile number '{IndianPhoneNumber.ToDisplay(canonical)}' already exists ({byPhone.FullName}).");
        }

        // Email is optional, and blank is not a value two employees can collide on.
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var address = email.Trim();
        var byEmail = await employeeRepository.GetByEmailAsync(address, cancellationToken);
        if (byEmail is not null && byEmail.Id != excludeId)
        {
            return Error.Conflict(
                "Employee.DuplicateEmail",
                $"An employee with email '{address}' already exists ({byEmail.FullName}).");
        }

        return null;
    }
}
