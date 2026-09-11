using MathilensERP.Api.Common;
using MathilensERP.Shared.Authorization;
using MathilensERP.Api.Common.Excel;
using MathilensERP.Api.Common.Export;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Api.Contracts.Pricing;
using MathilensERP.Application.Common;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Pricing;
using MathilensERP.Application.Pricing.Commands.Create;
using MathilensERP.Application.Pricing.Commands.Delete;
using MathilensERP.Application.Pricing.Commands.Import;
using MathilensERP.Application.Pricing.Commands.Update;
using MathilensERP.Application.Pricing.Queries.GetById;
using MathilensERP.Application.Pricing.Queries.ListAll;
using MathilensERP.Application.Pricing.Queries.Search;
using MathilensERP.Shared.Constants;
using MathilensERP.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>Price list endpoints — one unit price per cloth code, looked up on the New Order screen. URL-segment versioned per 00_MASTER_SPEC.md § 8.2.</summary>
[ApiController]
[Route("api/v1/cloth-prices")]
[Authorize(Policy = Permissions.PricingView)]
public sealed class ClothPricesController : ApiControllerBase
{
    private readonly ISender _sender;

    public ClothPricesController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>Downloads the whole price list as an .xlsx sheet. The Id column round-trips back through <see cref="Import"/> as the match key.</summary>
    [HttpGet("export")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> Export([FromQuery] ExportFormat format = ExportFormat.Xlsx, CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new ListAllClothPricesQuery(), cancellationToken);
        if (result.IsFailure)
        {
            return ToActionResult(result);
        }

        return format == ExportFormat.Pdf
            ? ExportResultFactory.Create(
                format,
                "Cloth Prices",
                "cloth-prices",
                ["Code", "Name", "Cost price", "Selling price"],
                result.Value.Select(c => new object?[] { c.ClothCode, c.ClothName, c.CostPrice, c.SellingPrice }).ToList())
            : ExportResultFactory.Create(
                format,
                "Cloth Prices",
                "cloth-prices",
                ClothPriceSheet.Headers,
                result.Value.Select(c => new object?[] { c.Id, c.ClothCode, c.ClothName, c.CostPrice, c.SellingPrice }).ToList());
    }

    /// <summary>
    /// Upserts the price list from an .xlsx sheet — matched on Id, else cloth code. Partial
    /// success: valid rows are saved and invalid ones come back listed by their row number.
    /// </summary>
    [HttpPost("import")]
    [Authorize(Policy = Permissions.PricingImport)]
    [RequestSizeLimit(ImportLimits.MaxFileBytes)]
    [ProducesResponseType(typeof(ApiResponse<ImportResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Import(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return ToActionResult(Result.Failure<ImportResultDto>(
                Error.Validation("Import.NoFile", "Select an .xlsx file to import.")));
        }

        IReadOnlyList<ExcelRow> rows;
        try
        {
            await using var stream = file.OpenReadStream();
            rows = ExcelSheet.Read(stream);
        }
        catch (InvalidDataException ex)
        {
            return ToActionResult(Result.Failure<ImportResultDto>(Error.Validation("Import.InvalidFile", ex.Message)));
        }

        var command = new ImportClothPricesCommand(rows
            .Select(r => new ClothPriceImportRow(
                r.RowNumber,
                r.GetGuid(ClothPriceSheet.Id),
                r.GetRequiredString(ClothPriceSheet.ClothCode),
                r.GetRequiredString(ClothPriceSheet.ClothName),
                r.GetDecimal(ClothPriceSheet.CostPrice),
                r.GetDecimal(ClothPriceSheet.SellingPrice)))
            .ToList());

        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Creates a new cloth price entry.</summary>
    [HttpPost]
    [Authorize(Policy = Permissions.PricingCreate)]
    [ProducesResponseType(typeof(ApiResponse<ClothPriceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateClothPriceRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateClothPriceCommand(request.ClothCode, request.ClothName, request.CostPrice, request.SellingPrice);
        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Returns a single cloth price entry by id.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<ClothPriceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetClothPriceByIdQuery(id), cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Searches cloth prices by code, paginated (00_MASTER_SPEC.md § 8.3).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ClothPriceDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Search(
        [FromQuery] string? search,
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new SearchClothPricesQuery(search, page, pageSize), cancellationToken);
        return ToPagedActionResult(result);
    }

    /// <summary>Updates an existing cloth price entry.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = Permissions.PricingEdit)]
    [ProducesResponseType(typeof(ApiResponse<ClothPriceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateClothPriceRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateClothPriceCommand(id, request.ClothCode, request.ClothName, request.CostPrice, request.SellingPrice);
        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>Soft-deletes a cloth price entry.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Permissions.PricingDelete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new DeleteClothPriceCommand(id), cancellationToken);
        return ToActionResult(result);
    }
}
