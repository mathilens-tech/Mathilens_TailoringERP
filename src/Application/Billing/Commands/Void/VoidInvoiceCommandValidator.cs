using FluentValidation;

namespace MathilensERP.Application.Billing.Commands.Void;

public sealed class VoidInvoiceCommandValidator : AbstractValidator<VoidInvoiceCommand>
{
    public VoidInvoiceCommandValidator()
    {
        RuleFor(x => x.InvoiceId)
            .NotEmpty();
    }
}
