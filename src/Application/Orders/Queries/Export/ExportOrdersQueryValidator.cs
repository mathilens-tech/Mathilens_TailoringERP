using FluentValidation;

namespace MathilensERP.Application.Orders.Queries.Export;

public sealed class ExportOrdersQueryValidator : AbstractValidator<ExportOrdersQuery>
{
    public ExportOrdersQueryValidator()
    {
        RuleFor(query => query.Status)
            .IsInEnum()
            .When(query => query.Status.HasValue);
    }
}
