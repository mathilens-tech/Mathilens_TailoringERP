using FluentValidation;
using MathilensERP.Application.Orders.Drafts.Commands;

namespace MathilensERP.Application.Orders.Drafts.Commands;

/// <summary>
/// What a draft must have to be storable — which is far less than an order must have to be created.
///
/// <para>That difference is the point of the feature. A draft is allowed no customer, no items, no
/// collection date and no prices; validating those here would reject exactly the half-finished
/// orders this table exists to hold. Only the fields the system itself depends on are checked.</para>
/// </summary>
public sealed class SaveOrderDraftCommandValidator : AbstractValidator<SaveOrderDraftCommand>
{
    /// <summary>Matches the column, which caps what the list has to render per row.</summary>
    private const int MaxSummaryLength = 300;

    /// <summary>
    /// A ceiling on one autosave, not a considered limit on order size. An order large enough to
    /// approach this has other problems; the number is here so a runaway client cannot write
    /// unbounded rows into the table on a timer.
    /// </summary>
    private const int MaxPayloadLength = 512_000;

    public SaveOrderDraftCommandValidator()
    {
        RuleFor(x => x.Kind)
            .NotEmpty()
            .MaximumLength(40);

        RuleFor(x => x.Summary)
            .MaximumLength(MaxSummaryLength);

        RuleFor(x => x.Payload)
            .NotEmpty()
            .MaximumLength(MaxPayloadLength);
    }
}
