using MathilensERP.Api.Common;
using MathilensERP.Shared.Authorization;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Application.Activity;
using MathilensERP.Application.Activity.Queries.Filters;
using MathilensERP.Application.Activity.Queries.Search;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>Activity trail endpoints — who did what, when (01_ARCHITECTURE.md § 12 Logging Strategy). URL-segment versioned per § 8.2.</summary>
[ApiController]
[Route("api/v1/activity-logs")]
[Authorize(Policy = Permissions.ActivityView)]
public sealed class ActivityLogsController : ApiControllerBase
{
    private readonly ISender _sender;

    public ActivityLogsController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>Recorded actions, newest first, narrowed by date range, user and screen.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ActivityLogDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Search(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] Guid? userId,
        [FromQuery] string? screen,
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var query = new SearchActivityLogsQuery(fromUtc, toUtc, userId, screen, page, pageSize);
        var result = await _sender.Send(query, cancellationToken);
        return ToPagedActionResult(result);
    }

    /// <summary>The screens and users that actually appear in the log, for populating the filter dropdowns.</summary>
    [HttpGet("filters")]
    [ProducesResponseType(typeof(ApiResponse<ActivityLogFiltersDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Filters(CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetActivityLogFiltersQuery(), cancellationToken);
        return ToActionResult(result);
    }
}
