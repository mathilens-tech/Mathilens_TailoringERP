using FluentValidation;
using MathilensERP.Shared.Contact;

namespace MathilensERP.Application.Common.Validation;

/// <summary>
/// The contact-detail rules, written once so the create form, the edit form and the spreadsheet
/// import cannot drift apart — a number the counter refuses and the importer accepts is how a
/// table ends up with four spellings of one customer.
/// </summary>
public static class ContactRules
{
    /// <summary>
    /// Required, and a real Indian mobile number once normalized (see <see cref="IndianPhoneNumber"/>).
    ///
    /// <para>Pair with <c>.Cascade(CascadeMode.Stop)</c> at the call site: without it a blank field
    /// reports both that it is required and that it is the wrong length, which reads as two
    /// problems where there is one.</para>
    /// </summary>
    public static IRuleBuilderOptions<T, string> MustBeAnIndianMobileNumber<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty()
            .WithMessage("Phone number is required.")
            .Must(IndianPhoneNumber.IsValid)
            // Two failures wear two messages. "Must be 10 digits" against a number that already has
            // ten sends the operator counting them again; the real fault is the series digit.
            .WithMessage((_, value) => IndianPhoneNumber.TryNormalize(value, out var normalized) && normalized.Length > 0
                ? "Phone number must start with 6, 7, 8 or 9."
                : "Phone number must be 10 digits.");

    /// <summary>Optional, but a plausible address when given.</summary>
    public static IRuleBuilderOptions<T, string?> MustBeAnEmailAddressWhenGiven<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(EmailAddress.IsValid)
            .WithMessage(EmailAddress.ValidationMessage);
}
