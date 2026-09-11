using FluentValidation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Pricing.Queries.Search;

public sealed class SearchClothPricesQueryValidator : AbstractValidator<SearchClothPricesQuery>
{
    public SearchClothPricesQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, PaginationDefaults.MaxPageSize);

        RuleFor(x => x.SearchTerm)
            .MaximumLength(200);
    }
}
