using MathilensERP.Api.Common;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Api.Common.Export;
using MathilensERP.Api.Contracts.Occasions;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Occasions;
using MathilensERP.Application.Occasions.Commands.RecordContact;
using MathilensERP.Application.Occasions.Queries.Search;
using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Authorization;
using MathilensERP.Shared.Constants;
using MathilensERP.Shared.Pagination;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>
/// Birthdays and wedding anniversaries coming up, and the shop's record of following them up.
///
/// Reads sit behind Reports.View, matching where these appear in the app. Recording a contact is
/// behind Customers.Manage instead: it writes to the customer relationship rather than to a report,
/// and reading a figure and acting on a customer are not the same privilege.
/// </summary>
[ApiController]
[Route("api/v1/occasions")]
[Authorize(Policy = Permissions.ReportsView)]
public sealed class OccasionsController : ApiControllerBase
{
    /// <summary>
    /// The shop asked for thirty days either way. Bounded rather than free: an unbounded window
    /// turns this into "every customer with a date on file", which is the customer list, not a
    /// call sheet.
    /// </summary>
    private const int DefaultWindowDays = 30;
    private const int MaxWindowDays = 365;

    /// <summary>An export takes the window whole. A shop's customer list is not big enough for this to be a concern.</summary>
    private const int ExportPageSize = 5000;

    private readonly ISender _sender;

    public OccasionsController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>Occasions inside the window — upcoming and not yet contacted, or already contacted.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<OccasionRowDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Search(
        [FromQuery] OccasionType occasion,
        [FromQuery] OccasionScope scope = OccasionScope.Upcoming,
        [FromQuery] int windowDays = DefaultWindowDays,
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var window = Math.Clamp(windowDays, 1, MaxWindowDays);

        var result = await _sender.Send(new SearchOccasionsQuery(occasion, scope, window, page, pageSize), cancellationToken);

        // Paged, so the rows go in `data` and the counts in `meta` — which is what every other list
        // endpoint does and what the client's apiGetPaged reads. ToActionResult instead nested the
        // whole PagedResult under `data`, so the browser got an object where it expected an array
        // and the report died on rows.map. The two helpers differ by one word and produce envelopes
        // that only diverge once something tries to iterate the result.
        return ToPagedActionResult(result);
    }

    /// <summary>
    /// The same list as <see cref="Search"/>, as a spreadsheet or a PDF.
    ///
    /// Takes the same filters, so what downloads matches what is on screen. Exporting the whole set
    /// from a filtered view is a quiet way to hand somebody the wrong call sheet.
    ///
    /// Not paginated: an export of page one of a call list is of no use to anybody, so this takes
    /// the window whole.
    /// </summary>
    [HttpGet("export")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> Export(
        [FromQuery] OccasionType occasion,
        [FromQuery] OccasionScope scope = OccasionScope.Upcoming,
        [FromQuery] int windowDays = DefaultWindowDays,
        [FromQuery] ExportFormat format = ExportFormat.Xlsx,
        CancellationToken cancellationToken = default)
    {
        var window = Math.Clamp(windowDays, 1, MaxWindowDays);

        var result = await _sender.Send(
            new SearchOccasionsQuery(occasion, scope, window, PaginationDefaults.DefaultPage, ExportPageSize),
            cancellationToken);

        if (result.IsFailure)
        {
            return ToActionResult(result);
        }

        var isBirthday = occasion == OccasionType.Birthday;
        var title = isBirthday ? "Birthday Report" : "Wedding Report";
        var subtitle = scope == OccasionScope.Upcoming
            ? $"Still to call · next {window} days"
            : $"Already contacted · last {window} days";

        return ExportResultFactory.Create(
            format,
            title,
            isBirthday ? "birthday-report" : "wedding-report",
            ["Customer", "Phone", "Email", "Date", "Days away", isBirthday ? "Turning" : "Years", "Contacted", "Remarks"],
            result.Value.Items
                .Select(r => new object?[]
                {
                    r.FullName,
                    r.PhoneNumber,
                    r.Email,
                    r.OccasionOn,
                    r.DaysAway,
                    r.YearsCompleted,
                    r.ContactedOn,
                    r.Remarks,
                })
                .ToList(),
            subtitle);
    }

    /// <summary>Marks an occasion as followed up, or amends the remarks if it was already marked.</summary>
    [HttpPost("contacts")]
    [Authorize(Policy = Permissions.CustomersEdit)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RecordContact([FromBody] RecordOccasionContactRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new RecordOccasionContactCommand(
                request.CustomerId,
                request.Occasion,
                request.OccasionYear,
                request.ContactedOn,
                request.Remarks),
            cancellationToken);

        return ToActionResult(result);
    }
}
