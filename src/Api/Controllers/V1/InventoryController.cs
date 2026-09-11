using MathilensERP.Api.Common;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Api.Contracts.Inventory;
using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Inventory;
using MathilensERP.Application.Inventory.Commands.Receive;
using MathilensERP.Application.Inventory.Queries.Search;
using MathilensERP.Application.Inventory.Queries.Stock;
using MathilensERP.Shared.Authorization;
using MathilensERP.Shared.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MathilensERP.Api.Controllers.V1;

/// <summary>
/// Inventory endpoints — currently the log of cloth arriving at the shop. URL-segment versioned
/// per 00_MASTER_SPEC.md § 8.2.
/// </summary>
[ApiController]
[Route("api/v1/inventory")]
[Authorize(Policy = Permissions.InventoryView)]
public sealed class InventoryController : ApiControllerBase
{
    private readonly ISender _sender;

    public InventoryController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>Records a delivery of cloth against a price-list entry.</summary>
    [HttpPost("cloth-receipts")]
    [Authorize(Policy = Permissions.InventoryCreate)]
    [ProducesResponseType(typeof(ApiResponse<ClothReceiptDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReceiveCloth([FromBody] ReceiveClothRequest request, CancellationToken cancellationToken)
    {
        var command = new ReceiveClothCommand(
            request.ClothPriceId,
            request.Quantity,
            request.Unit,
            request.ReceivedOn,
            request.SupplierName,
            request.InvoiceNumber,
            request.RatePerUnit,
            request.Notes);

        var result = await _sender.Send(command, cancellationToken);
        return ToActionResult(result);
    }

    /// <summary>
    /// The cloth receipt log, newest delivery first, paginated (00_MASTER_SPEC.md § 8.3).
    /// Searchable by cloth code, cloth name, supplier or invoice number, and narrowable by cloth
    /// and by received-date range.
    /// </summary>
    [HttpGet("cloth-receipts")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ClothReceiptDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SearchClothReceipts(
        [FromQuery] string? search,
        [FromQuery] Guid? clothPriceId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var query = new SearchClothReceiptsQuery(search, clothPriceId, from, to, page, pageSize);
        var result = await _sender.Send(query, cancellationToken);
        return ToPagedActionResult(result);
    }

    /// <summary>
    /// Total quantity received per cloth code, split by unit, paginated.
    ///
    /// This is what has come *in*, not what is left: nothing records cloth leaving the shop, so
    /// the figure only ever grows. Making it a true balance needs cloth issued to be recorded.
    /// </summary>
    [HttpGet("stock")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<StockSummaryDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> StockSummary(
        [FromQuery] string? search,
        [FromQuery] int page = PaginationDefaults.DefaultPage,
        [FromQuery] int pageSize = PaginationDefaults.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(new GetStockSummaryQuery(search, page, pageSize), cancellationToken);
        return ToPagedActionResult(result);
    }
}
