using FluentValidation;
using MathilensERP.Application.Customers.Commands.Create;
using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Contact;

namespace MathilensERP.Application.Customers.Commands.Import;

/// <summary>What an import row will do when the upload is committed.</summary>
internal enum CustomerImportAction
{
    /// <summary>The row broke a validation rule and will be reported by its spreadsheet row number.</summary>
    Fail,
    Create,
    /// <summary>Matched a customer already in the table, by id or by phone number.</summary>
    UpdateExisting,
    /// <summary>Matched an earlier row of this same file — the sheet lists one person twice.</summary>
    UpdateEarlierRow,
}

/// <param name="EmailOwner">
/// An existing customer holding this row's email who is not the row's own match. Reported as a
/// warning and nothing more: families share an address, so it does not change what the row does.
/// </param>
internal sealed record CustomerImportStep(
    CustomerImportRow Row,
    CustomerImportAction Action,
    string PhoneNumber,
    Customer? ExistingMatch = null,
    int? EarlierRowNumber = null,
    Customer? EmailOwner = null,
    string? Error = null);

/// <summary>
/// Decides what every row of an upload will do, without doing any of it.
///
/// <para>Both the pre-import summary and the import itself read their answer from here, so the
/// counts an operator approves are the counts they get. A preview computed by separate code is a
/// preview that can lie, and it only has to lie once to cost the shop a customer record.</para>
/// </summary>
internal static class CustomerImportPlanner
{
    public static async Task<IReadOnlyList<CustomerImportStep>> PlanAsync(
        IReadOnlyList<CustomerImportRow> rows,
        ICustomerRepository customerRepository,
        IValidator<CreateCustomerCommand> rowValidator,
        bool includeEmailWarnings,
        CancellationToken cancellationToken)
    {
        var steps = new List<CustomerImportStep>(rows.Count);

        // Rows planned earlier in this pass are not in the database yet, so without this a file
        // listing one phone number twice would plan two creates and insert the person twice.
        var plannedPhoneNumbers = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows)
        {
            // Reuses the create command's rules, so the spreadsheet cannot accept a number or an
            // address the counter would reject — normalization included.
            var candidate = new CreateCustomerCommand(row.FullName, row.PhoneNumber, row.Email, row.Address, row.Notes);
            var validation = await rowValidator.ValidateAsync(candidate, cancellationToken);
            if (!validation.IsValid)
            {
                steps.Add(new CustomerImportStep(
                    row,
                    CustomerImportAction.Fail,
                    string.Empty,
                    Error: string.Join(" ", validation.Errors.Select(e => e.ErrorMessage))));
                continue;
            }

            // Valid, so it normalizes by definition — matching is done on the canonical form, or a
            // sheet written as "8220070363" would never find the "+918220070363" it belongs to.
            var phoneNumber = IndianPhoneNumber.Normalize(row.PhoneNumber);

            // An id that no longer resolves (stale export, since-deleted record) falls through to
            // the phone number rather than failing the row.
            var byId = row.Id is { } id ? await customerRepository.GetByIdAsync(id, cancellationToken) : null;
            var existing = byId ?? await customerRepository.GetByPhoneNumberAsync(phoneNumber, cancellationToken);

            var emailOwner = includeEmailWarnings ? await FindEmailOwnerAsync(
                customerRepository, row.Email, existing?.Id, cancellationToken) : null;

            if (existing is not null)
            {
                steps.Add(new CustomerImportStep(
                    row, CustomerImportAction.UpdateExisting, phoneNumber, ExistingMatch: existing, EmailOwner: emailOwner));
            }
            else if (plannedPhoneNumbers.TryGetValue(phoneNumber, out var earlierRow))
            {
                steps.Add(new CustomerImportStep(
                    row, CustomerImportAction.UpdateEarlierRow, phoneNumber, EarlierRowNumber: earlierRow, EmailOwner: emailOwner));
            }
            else
            {
                plannedPhoneNumbers[phoneNumber] = row.RowNumber;
                steps.Add(new CustomerImportStep(row, CustomerImportAction.Create, phoneNumber, EmailOwner: emailOwner));
            }
        }

        return steps;
    }

    private static async Task<Customer?> FindEmailOwnerAsync(
        ICustomerRepository customerRepository,
        string? email,
        Guid? excludeId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var matches = await customerRepository.FindPotentialDuplicatesAsync(null, email, excludeId, cancellationToken);
        return matches.Count > 0 ? matches[0] : null;
    }
}
