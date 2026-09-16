using MathilensERP.Api.Common;
using MathilensERP.Api.Common.Export;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Application.Backup.Queries.ExportBackup;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>
/// Downloads everything the shop holds, as one file.
///
/// <para>Behind <see cref="Permissions.SettingsEdit"/> rather than the SettingsView every other
/// settings screen reads under. This one request returns every customer's name, phone number,
/// address and date of birth in a single downloadable file — the most concentrated piece of
/// personal data the product can produce. Front desk and tailor staff have a job that needs the
/// customer in front of them, not all of them at once, and the stricter of the two permissions is
/// the one that matches what is being handed over.</para>
/// </summary>
[ApiController]
[Route("api/v1/backup")]
[Authorize(Policy = Permissions.SettingsEdit)]
public sealed class BackupController : ApiControllerBase
{
    private readonly ISender _sender;

    public BackupController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>
    /// The whole shop, in the chosen format.
    ///
    /// <para>An export, not a restore point: nothing in this product reads any of these files back.
    /// The JSON is the one shaped so that a future importer could, which is why it carries a format
    /// version and keeps the ids and the relationships between tables intact.</para>
    /// </summary>
    [HttpGet("export")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Export(
        [FromQuery] BackupFormat format = BackupFormat.Json,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new ExportBackupQuery(), cancellationToken);
        if (result.IsFailure)
        {
            return ToActionResult(result);
        }

        // Surfaced as a header rather than folded into the file. A truncated backup has to be
        // detectable without opening it, and the three non-JSON formats have nowhere to put a flag
        // that a reader would reliably notice.
        Response.Headers["X-Backup-Truncated"] = result.Value.IsTruncated ? "true" : "false";

        return BackupResultFactory.Create(format, BackupTables.From(result.Value));
    }
}
