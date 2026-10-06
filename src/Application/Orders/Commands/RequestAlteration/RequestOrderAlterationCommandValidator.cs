using FluentValidation;
using MathilensERP.Application.Common.Validation;
using MathilensERP.Domain.Orders;

namespace MathilensERP.Application.Orders.Commands.RequestAlteration;

public sealed class RequestOrderAlterationCommandValidator : AbstractValidator<RequestOrderAlterationCommand>
{
    public RequestOrderAlterationCommandValidator()
    {
        RuleFor(x => x.OrderId)
            .NotEmpty();

        // Required, unlike most free text on an order. An alteration with no reason is a garment
        // back on the bench with nobody able to say what for — and the reason is the whole value of
        // the record to whoever reads it next week.
        RuleFor(x => x.Reason)
            .NotEmpty()
            .WithMessage("Say what needs altering.")
            .MaximumLength(OrderAlteration.ReasonMaxLength);

        // Zero is the normal answer; negative would be the shop paying the customer, which is a
        // refund and belongs on the invoice rather than here.
        RuleFor(x => x.ChargeAmount)
            .GreaterThanOrEqualTo(0);
    }
}
