using FluentValidation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Activity.Queries.Search;

public sealed class SearchActivityLogsQueryValidator : AbstractValidator<SearchActivityLogsQuery>
{
    public SearchActivityLogsQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, PaginationDefaults.MaxPageSize);

        RuleFor(x => x.ToUtc)
            .GreaterThanOrEqualTo(x => x.FromUtc!.Value)
            .When(x => x.FromUtc.HasValue && x.ToUtc.HasValue)
            .WithMessage("'ToUtc' must be on or after 'FromUtc'.");
    }
}
