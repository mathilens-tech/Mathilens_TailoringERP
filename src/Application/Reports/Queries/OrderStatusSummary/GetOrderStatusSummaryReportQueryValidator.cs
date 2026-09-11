using FluentValidation;

namespace MathilensERP.Application.Reports.Queries.OrderStatusSummary;

public sealed class GetOrderStatusSummaryReportQueryValidator : AbstractValidator<GetOrderStatusSummaryReportQuery>
{
    public GetOrderStatusSummaryReportQueryValidator()
    {
        RuleFor(x => x.ToUtc)
            .GreaterThanOrEqualTo(x => x.FromUtc)
            .WithMessage("'ToUtc' must be on or after 'FromUtc'.");
    }
}
