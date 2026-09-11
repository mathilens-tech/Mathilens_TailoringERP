using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Pricing;
using MathilensERP.Shared.Pagination;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Pricing.Queries.Search;

public sealed class SearchClothPricesQueryHandler : IQueryHandler<SearchClothPricesQuery, Result<PagedResult<ClothPriceDto>>>
{
    private readonly IClothPriceRepository _clothPriceRepository;

    public SearchClothPricesQueryHandler(IClothPriceRepository clothPriceRepository)
    {
        _clothPriceRepository = clothPriceRepository;
    }

    public async Task<Result<PagedResult<ClothPriceDto>>> Handle(SearchClothPricesQuery query, CancellationToken cancellationToken)
    {
        var page = await _clothPriceRepository.SearchAsync(query.SearchTerm, query.Page, query.PageSize, cancellationToken);

        var items = page.Items.Select(c => c.ToDto()).ToList();

        return new PagedResult<ClothPriceDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
