using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Activity.Queries.Filters;

/// <summary>The screens and users present in the log, for populating the filter dropdowns.</summary>
public sealed record GetActivityLogFiltersQuery : IQuery<Result<ActivityLogFiltersDto>>;
