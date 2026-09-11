using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Customers.Queries.FindDuplicates;

/// <summary>
/// Looks for customers already holding a phone number or email, so the form can warn before a
/// second record for the same person is created (FR-04).
///
/// <para>Advisory. It reports what exists and leaves the decision to the operator — the rule that
/// actually refuses a save is the phone-number uniqueness check in the create and update handlers.</para>
/// </summary>
/// <param name="ExcludeId">The customer being edited, so it is not reported as its own duplicate.</param>
public sealed record FindCustomerDuplicatesQuery(string? PhoneNumber, string? Email, Guid? ExcludeId = null)
    : IQuery<Result<IReadOnlyList<CustomerDuplicateDto>>>;
