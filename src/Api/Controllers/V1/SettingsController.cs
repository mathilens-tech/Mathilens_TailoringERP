using MathilensERP.Api.Common;
using MathilensERP.Shared.Authorization;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Api.Contracts.Settings;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Settings;
using MathilensERP.Application.Settings.Commands.Delete;
using MathilensERP.Application.Settings.Commands.Upsert;
using MathilensERP.Application.Settings.Queries.GetByKey;
using MathilensERP.Application.Settings.Queries.List;
using MathilensERP.Shared.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>Shop-level configuration endpoints (00_MASTER_SPEC.md § 3, 02_DATABASE.md § 10.12). URL-segment versioned per § 8.2.</summary>
[ApiController]
[Route("api/v1/settings")]
[Authorize(Policy = Permissions.SettingsView)]
public sealed class SettingsController : ApiControllerBase
{
    private readonly ISender _sender;

    public SettingsController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>Creates or updates a setting's value — settings are written only through explicit administrative action (02_DATABASE.md § 10.12).</summary>
    [HttpPut("{key}")]
    [Authorize(Policy = Permissions.SettingsEdit)]
    [ProducesResponseType(typeof(ApiResponse<SettingDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Upsert(string key, [FromBody] UpsertSettingRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new UpsertSettingCommand(key, request.Value), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Returns a single setting by key.</summary>
    [HttpGet("{key}")]
    [ProducesResponseType(typeof(ApiResponse<SettingDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByKey(string key, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetSettingByKeyQuery(key), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Lists every configured setting, paginated (00_MASTER_SPEC.md § 8.3).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<SettingDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> List(
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new ListSettingsQuery(page, pageSize), cancellationToken);
        return ToPagedActionResult(result);
    }

    /// <summary>Removes a setting entirely.</summary>
    [HttpDelete("{key}")]
    [Authorize(Policy = Permissions.SettingsEdit)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(string key, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new DeleteSettingCommand(key), cancellationToken);
        return ToActionResult(result);
    }
}
