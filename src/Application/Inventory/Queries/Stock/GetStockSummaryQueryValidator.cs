using FluentValidation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Inventory.Queries.Stock;

public sealed class GetStockSummaryQueryValidator : AbstractValidator<GetStockSummaryQuery>
{
    public GetStockSummaryQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, PaginationDefaults.MaxPageSize);
    }
}
