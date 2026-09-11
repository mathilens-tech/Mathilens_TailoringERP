using MathilensERP.Application.Common.Mediator;
using MathilensERP.Domain.Inventory;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Inventory.Queries.Stock;

/// <summary>How much of each cloth the shop has taken in, by cloth code.</summary>
public sealed record GetStockSummaryQuery(string? Search, int Page, int PageSize)
    : IQuery<Result<PagedResult<StockSummaryDto>>>;

/// <summary>
/// One cloth's stock position.
/// </summary>
/// <param name="Quantities">
/// Split by unit rather than added up. 10 metres and 3 rolls are both real, and a single "13"
/// would be a number for neither.
/// </param>
/// <param name="LastReceivedOn">The most recent delivery, so a stale line is visible as stale.</param>
public sealed record StockSummaryDto(
    Guid ClothPriceId,
    string ClothCode,
    string ClothName,
    IReadOnlyList<StockQuantityDto> Quantities,
    DateOnly? LastReceivedOn);

/// <param name="Available">
/// Received minus used. Can go negative — cloth issued against a code nothing was received under,
/// or issued in a different unit than it arrived in. That is a real bookkeeping mistake, and
/// showing it is how it gets found.
/// </param>
public sealed record StockQuantityDto(ClothUnit Unit, decimal Received, decimal Used, decimal Available);
