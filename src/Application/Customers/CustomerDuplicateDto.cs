namespace MathilensERP.Application.Customers;

/// <summary>
/// An existing customer who shares a contact detail with the one being entered.
///
/// <para>Carries which detail matched, because the two mean different things at a counter: a
/// shared email is common in a family and rarely a mistake, while a shared phone number is
/// almost always the same person being written down twice.</para>
/// </summary>
public sealed record CustomerDuplicateDto(
    Guid Id,
    string FullName,
    string PhoneNumber,
    string? Email,
    bool MatchesPhoneNumber,
    bool MatchesEmail);
