using FluentValidation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Customers.Queries.Search;

public sealed class SearchCustomersQueryValidator : AbstractValidator<SearchCustomersQuery>
{
    public SearchCustomersQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, PaginationDefaults.MaxPageSize);

        RuleFor(x => x.SearchTerm)
            .MaximumLength(200);
    }
}
