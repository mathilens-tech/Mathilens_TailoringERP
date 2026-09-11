using FluentValidation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.WhatsApp.Queries.Search;

public sealed class SearchWhatsAppMessagesQueryValidator : AbstractValidator<SearchWhatsAppMessagesQuery>
{
    public SearchWhatsAppMessagesQueryValidator()
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
