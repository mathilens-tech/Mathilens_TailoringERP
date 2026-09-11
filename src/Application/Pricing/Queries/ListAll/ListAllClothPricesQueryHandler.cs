using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Pricing;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Pricing.Queries.ListAll;

public sealed class ListAllClothPricesQueryHandler : IQueryHandler<ListAllClothPricesQuery, Result<IReadOnlyList<ClothPriceDto>>>
{
    private readonly IClothPriceRepository _clothPriceRepository;

    public ListAllClothPricesQueryHandler(IClothPriceRepository clothPriceRepository)
    {
        _clothPriceRepository = clothPriceRepository;
    }

    public async Task<Result<IReadOnlyList<ClothPriceDto>>> Handle(ListAllClothPricesQuery query, CancellationToken cancellationToken)
    {
        var clothPrices = await _clothPriceRepository.ListAllAsync(cancellationToken);

        return Result.Success<IReadOnlyList<ClothPriceDto>>(clothPrices.Select(c => c.ToDto()).ToList());
    }
}
