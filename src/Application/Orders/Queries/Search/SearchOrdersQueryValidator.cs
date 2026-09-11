using FluentValidation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Orders.Queries.Search;

public sealed class SearchOrdersQueryValidator : AbstractValidator<SearchOrdersQuery>
{
    public SearchOrdersQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, PaginationDefaults.MaxPageSize);

        RuleFor(x => x.Status)
            .IsInEnum()
            .When(x => x.Status.HasValue);
    }
}
