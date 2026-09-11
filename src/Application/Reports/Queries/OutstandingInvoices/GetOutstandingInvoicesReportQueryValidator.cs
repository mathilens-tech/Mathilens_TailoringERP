using FluentValidation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Reports.Queries.OutstandingInvoices;

public sealed class GetOutstandingInvoicesReportQueryValidator : AbstractValidator<GetOutstandingInvoicesReportQuery>
{
    public GetOutstandingInvoicesReportQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, PaginationDefaults.MaxPageSize);
    }
}
