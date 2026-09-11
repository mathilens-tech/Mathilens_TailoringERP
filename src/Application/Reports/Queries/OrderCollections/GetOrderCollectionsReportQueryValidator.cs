using FluentValidation;

namespace MathilensERP.Application.Reports.Queries.OrderCollections;

public sealed class GetOrderCollectionsReportQueryValidator : AbstractValidator<GetOrderCollectionsReportQuery>
{
    public GetOrderCollectionsReportQueryValidator()
    {
        RuleFor(x => x.ToUtc)
            .GreaterThanOrEqualTo(x => x.FromUtc)
            .WithMessage("'ToUtc' must be on or after 'FromUtc'.");
    }
}
