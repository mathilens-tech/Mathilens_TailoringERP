using MathilensERP.Api.Common;
using MathilensERP.Api.Common.Export;
using MathilensERP.Shared.Authorization;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Application.Activity;
using MathilensERP.Application.Activity.Queries.Export;
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

    /// <summary>
    /// Downloads the filtered activity trail as a spreadsheet or PDF.
    ///
    /// <para>Takes the same four filters as <see cref="Search"/> and no page number: the file is
    /// what the screen is currently showing, not the page of it somebody happens to be on.</para>
    /// </summary>
    [HttpGet("export")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Export(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] Guid? userId,
        [FromQuery] string? screen,
        [FromQuery] ExportFormat format = ExportFormat.Xlsx,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(
            new ExportActivityLogsQuery(fromUtc, toUtc, userId, screen), cancellationToken);

        if (result.IsFailure)
        {
            return ToActionResult(result);
        }

        return ExportResultFactory.Create(
            format,
            "Activity Log",
            "activity-log",
            ["Date", "Time", "User", "Screen", "Action", "Description"],
            result.Value.Select(log => new object?[]
            {
                // Date and time in two columns, as on screen: a spreadsheet can then sort by day
                // without the reader parsing a timestamp, and a printed page stays narrow.
                log.OccurredAtUtc.ToString("yyyy-MM-dd"),
                log.OccurredAtUtc.ToString("HH:mm"),
                // The trail records actions by people who may since have been deleted, so the name
                // is nullable all the way down. "System" is the truthful reading of a null here:
                // it is what the expiry sweep and other unattended work write.
                log.UserName ?? "System",
                log.Screen,
                log.Action,
                Describe(log),
            }).ToList(),
            SubtitleFor(fromUtc, toUtc));
    }

    /// <summary>
    /// What one entry did, as a single line.
    ///
    /// <para>Mirrors <c>describe()</c> on the Activity Log screen deliberately: a download that
    /// summarised an edit differently from the page it was taken from would be the one copy nobody
    /// could check against anything. One action stays one row — a changed field per line turned a
    /// single edit into six rows that read like six events.</para>
    /// </summary>
    private static string Describe(ActivityLogDto log) =>
        log.Changes.Count > 0
            ? string.Join(" · ", log.Changes.Select(c => $"{c.Field}: {c.From ?? "empty"} → {c.To ?? "empty"}"))
            : log.Description ?? "—";

    /// <summary>
    /// The period the file covers, printed under the title.
    ///
    /// <para>Worth the line because an activity export is filed and read later, and a page of
    /// entries with no stated range invites the reader to assume it is everything.</para>
    /// </summary>
    private static string? SubtitleFor(DateTime? fromUtc, DateTime? toUtc) =>
        (fromUtc, toUtc) switch
        {
            (null, null) => null,
            ({ } from, null) => $"From {from:yyyy-MM-dd}",
            (null, { } to) => $"Up to {to:yyyy-MM-dd}",
            ({ } from, { } to) => $"{from:yyyy-MM-dd} to {to:yyyy-MM-dd}",
        };

    /// <summary>The screens and users that actually appear in the log, for populating the filter dropdowns.</summary>
    [HttpGet("filters")]
    [ProducesResponseType(typeof(ApiResponse<ActivityLogFiltersDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Filters(CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetActivityLogFiltersQuery(), cancellationToken);
        return ToActionResult(result);
    }
}
