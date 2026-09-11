using FluentValidation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Inventory.Queries.Search;

public sealed class SearchClothReceiptsQueryValidator : AbstractValidator<SearchClothReceiptsQuery>
{
    public SearchClothReceiptsQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, PaginationDefaults.MaxPageSize);

        RuleFor(x => x.FromDate)
            .LessThanOrEqualTo(x => x.ToDate!.Value)
            .WithMessage("The 'from' date must not be after the 'to' date.")
            .When(x => x.FromDate.HasValue && x.ToDate.HasValue);
    }
}
