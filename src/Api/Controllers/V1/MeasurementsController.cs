using MathilensERP.Api.Common;
using MathilensERP.Shared.Authorization;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Api.Contracts.Measurements;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Measurements;
using MathilensERP.Application.Measurements.Commands.Create;
using MathilensERP.Application.Measurements.Commands.UpdateValues;
using MathilensERP.Application.Measurements.Queries.ByCustomer;
using MathilensERP.Application.Measurements.Queries.GetById;
using MathilensERP.Application.Measurements.Queries.History;
using MathilensERP.Application.Measurements.Templates;
using MathilensERP.Application.Measurements.Templates.Commands;
using MathilensERP.Application.Measurements.Templates.Queries;
using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>Measurement management endpoints (00_MASTER_SPEC.md § 3, 02_DATABASE.md §§ 10.4-10.5). URL-segment versioned per § 8.2.</summary>
[ApiController]
[Route("api/v1")]
[Authorize(Policy = Permissions.MeasurementsView)]
public sealed class MeasurementsController : ApiControllerBase
{
    private readonly ISender _sender;

    public MeasurementsController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>Records a new garment-type measurement set for a customer.</summary>
    [HttpPost("customers/{customerId:guid}/measurements")]
    [Authorize(Policy = Permissions.MeasurementsCreate)]
    [ProducesResponseType(typeof(ApiResponse<MeasurementDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(Guid customerId, [FromBody] CreateMeasurementRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateMeasurementCommand(customerId, request.GarmentType, request.Values, request.Notes);
        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Lists every garment-type measurement recorded for a customer.</summary>
    [HttpGet("customers/{customerId:guid}/measurements")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<MeasurementDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListByCustomer(Guid customerId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetMeasurementsByCustomerQuery(customerId), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Returns a single measurement record by id.</summary>
    [HttpGet("measurements/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<MeasurementDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetMeasurementByIdQuery(id), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Updates a measurement's values, snapshotting the previous values into history first.</summary>
    [HttpPut("measurements/{id:guid}")]
    [Authorize(Policy = Permissions.MeasurementsEdit)]
    [ProducesResponseType(typeof(ApiResponse<MeasurementDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateValues(Guid id, [FromBody] UpdateMeasurementValuesRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new UpdateMeasurementValuesCommand(id, request.Values, request.Notes), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Returns the historical snapshots for a measurement, newest first, paginated (00_MASTER_SPEC.md § 8.3).</summary>
    [HttpGet("measurements/{id:guid}/history")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<MeasurementHistoryDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetHistory(
        Guid id,
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new GetMeasurementHistoryQuery(id, page, pageSize), cancellationToken);
        return ToPagedActionResult(result);
    }

    /// <summary>
    /// The measurement points to ask for, per garment type, in the shop's own order. Readable by
    /// anyone who may take a measurement — front desk and tailor staff hold no Settings
    /// permission, so this deliberately does not live under the Settings endpoints.
    /// </summary>
    [HttpGet("measurements/templates")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<MeasurementTemplateDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTemplates(CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetMeasurementTemplatesQuery(), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Replaces one garment type's measurement points and their order. Configuration, so it takes Settings.Manage.</summary>
    [HttpPut("measurements/templates/{garmentType}")]
    [Authorize(Policy = Permissions.SettingsEdit)]
    [ProducesResponseType(typeof(ApiResponse<MeasurementTemplateDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SetTemplate(
        string garmentType,
        [FromBody] SetMeasurementTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new SetMeasurementTemplateCommand(garmentType, request.Points), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Restores a garment type to the built-in measurement points.</summary>
    [HttpDelete("measurements/templates/{garmentType}")]
    [Authorize(Policy = Permissions.SettingsEdit)]
    [ProducesResponseType(typeof(ApiResponse<MeasurementTemplateDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ResetTemplate(string garmentType, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new ResetMeasurementTemplateCommand(garmentType), cancellationToken);
        return ToActionResult(result);
    }
}
