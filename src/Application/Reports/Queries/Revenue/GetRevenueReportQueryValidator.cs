using FluentValidation;

namespace MathilensERP.Application.Reports.Queries.Revenue;

public sealed class GetRevenueReportQueryValidator : AbstractValidator<GetRevenueReportQuery>
{
    public GetRevenueReportQueryValidator()
    {
        RuleFor(x => x.ToUtc)
            .GreaterThanOrEqualTo(x => x.FromUtc)
            .WithMessage("'ToUtc' must be on or after 'FromUtc'.");
    }
}
