using FluentValidation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Settings.Queries.List;

public sealed class ListSettingsQueryValidator : AbstractValidator<ListSettingsQuery>
{
    public ListSettingsQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, PaginationDefaults.MaxPageSize);
    }
}
