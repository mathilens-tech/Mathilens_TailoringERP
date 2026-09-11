using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Inventory.Queries.Stock;

public sealed class GetStockSummaryQueryHandler
    : IQueryHandler<GetStockSummaryQuery, Result<PagedResult<StockSummaryDto>>>
{
    private readonly IClothReceiptRepository _receiptRepository;

    public GetStockSummaryQueryHandler(IClothReceiptRepository receiptRepository)
    {
        _receiptRepository = receiptRepository;
    }

    public async Task<Result<PagedResult<StockSummaryDto>>> Handle(
        GetStockSummaryQuery query,
        CancellationToken cancellationToken)
    {
        var page = await _receiptRepository.GetStockSummaryAsync(query.Search, query.Page, query.PageSize, cancellationToken);

        // The repository pages over distinct cloths but returns one row per cloth *and unit*, so a
        // cloth received in both metres and rolls arrives as two rows and is folded into one line.
        var items = page.Items
            .GroupBy(row => new { row.ClothPriceId, row.ClothCode, row.ClothName })
            .Select(group => new StockSummaryDto(
                group.Key.ClothPriceId,
                group.Key.ClothCode,
                group.Key.ClothName,
                group
                    .OrderBy(row => row.Unit)
                    .Select(row => new StockQuantityDto(row.Unit, row.Received, row.Used, row.Received - row.Used))
                    .ToList(),
                group.Max(row => row.LastReceivedOn)))
            .OrderBy(dto => dto.ClothCode, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new PagedResult<StockSummaryDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
