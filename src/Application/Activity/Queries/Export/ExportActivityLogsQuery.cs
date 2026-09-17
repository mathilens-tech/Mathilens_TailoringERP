using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Activity.Queries.Export;

/// <summary>
/// The whole filtered activity trail, bounded for a file download rather than an interactive page.
///
/// <para>Separate from <see cref="Search.SearchActivityLogsQuery"/> for the same reason the order
/// export is separate from the order list: an interactive page stays capped at a screenful, and
/// raising that cap to serve downloads would let an ordinary request pull thousands of rows.</para>
///
/// <para>It carries the same four filters and nothing else, because an export that did not match
/// the screen it was taken from is a quiet way to hand somebody the wrong answer — the usual
/// version of which is exporting everything from a view narrowed to one day.</para>
/// </summary>
public sealed record ExportActivityLogsQuery(
    DateTime? FromUtc,
    DateTime? ToUtc,
    Guid? UserId,
    string? Screen) : IQuery<Result<IReadOnlyList<ActivityLogDto>>>;
