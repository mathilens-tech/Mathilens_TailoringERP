using FluentValidation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Employees.Queries.Search;

public sealed class SearchEmployeesQueryValidator : AbstractValidator<SearchEmployeesQuery>
{
    public SearchEmployeesQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, PaginationDefaults.MaxPageSize);

        RuleFor(x => x.SearchTerm)
            .MaximumLength(200);
    }
}
