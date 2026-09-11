using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Inventory.Queries.Search;

public sealed class SearchClothReceiptsQueryHandler
    : IQueryHandler<SearchClothReceiptsQuery, Result<PagedResult<ClothReceiptDto>>>
{
    private readonly IClothReceiptRepository _receiptRepository;

    public SearchClothReceiptsQueryHandler(IClothReceiptRepository receiptRepository)
    {
        _receiptRepository = receiptRepository;
    }

    public async Task<Result<PagedResult<ClothReceiptDto>>> Handle(
        SearchClothReceiptsQuery query,
        CancellationToken cancellationToken)
    {
        var page = await _receiptRepository.SearchAsync(
            query.Search, query.ClothPriceId, query.FromDate, query.ToDate, query.Page, query.PageSize, cancellationToken);

        var items = page.Items.Select(r => r.ToDto()).ToList();

        return new PagedResult<ClothReceiptDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
