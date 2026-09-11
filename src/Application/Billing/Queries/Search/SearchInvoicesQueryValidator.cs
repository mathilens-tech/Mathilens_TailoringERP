using FluentValidation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Billing.Queries.Search;

public sealed class SearchInvoicesQueryValidator : AbstractValidator<SearchInvoicesQuery>
{
    public SearchInvoicesQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, PaginationDefaults.MaxPageSize);

        RuleFor(x => x.Status)
            .IsInEnum()
            .When(x => x.Status.HasValue);

        RuleFor(x => x.FromUtc)
            .LessThanOrEqualTo(x => x.ToUtc!.Value)
            .WithMessage("The 'from' date must not be after the 'to' date.")
            .When(x => x.FromUtc.HasValue && x.ToUtc.HasValue);
    }
}
