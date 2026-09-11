using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Pricing;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Pricing.Queries.GetById;

public sealed class GetClothPriceByIdQueryHandler : IQueryHandler<GetClothPriceByIdQuery, Result<ClothPriceDto>>
{
    private readonly IClothPriceRepository _clothPriceRepository;

    public GetClothPriceByIdQueryHandler(IClothPriceRepository clothPriceRepository)
    {
        _clothPriceRepository = clothPriceRepository;
    }

    public async Task<Result<ClothPriceDto>> Handle(GetClothPriceByIdQuery query, CancellationToken cancellationToken)
    {
        var clothPrice = await _clothPriceRepository.GetByIdAsync(query.Id, cancellationToken);

        return clothPrice is null
            ? Result.Failure<ClothPriceDto>(Error.NotFound("ClothPrice.NotFound", $"No price was found with id '{query.Id}'."))
            : clothPrice.ToDto();
    }
}
