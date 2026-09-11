using FluentValidation;
using MathilensERP.Shared.Constants;

namespace MathilensERP.Application.Measurements.Queries.History;

public sealed class GetMeasurementHistoryQueryValidator : AbstractValidator<GetMeasurementHistoryQuery>
{
    public GetMeasurementHistoryQueryValidator()
    {
        RuleFor(x => x.MeasurementId)
            .NotEmpty();

        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, PaginationDefaults.MaxPageSize);
    }
}
