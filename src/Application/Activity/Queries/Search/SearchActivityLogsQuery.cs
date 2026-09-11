using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Activity.Queries.Search;

/// <summary>The activity trail, narrowed by date range, user and screen (00_MASTER_SPEC.md § 8.4 Filtering).</summary>
public sealed record SearchActivityLogsQuery(
    DateTime? FromUtc,
    DateTime? ToUtc,
    Guid? UserId,
    string? Screen,
    int Page,
    int PageSize) : IQuery<Result<PagedResult<ActivityLogDto>>>;
