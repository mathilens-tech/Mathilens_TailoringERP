using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Pricing;
using MathilensERP.Domain.Pricing;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Pricing.Commands.Create;

public sealed class CreateClothPriceCommandHandler : ICommandHandler<CreateClothPriceCommand, Result<ClothPriceDto>>
{
    private readonly IClothPriceRepository _clothPriceRepository;

    public CreateClothPriceCommandHandler(IClothPriceRepository clothPriceRepository)
    {
        _clothPriceRepository = clothPriceRepository;
    }

    public async Task<Result<ClothPriceDto>> Handle(CreateClothPriceCommand command, CancellationToken cancellationToken)
    {
        var existing = await _clothPriceRepository.GetByClothCodeAsync(command.ClothCode, cancellationToken);
        if (existing is not null)
        {
            return Result.Failure<ClothPriceDto>(
                Error.Conflict("ClothPrice.DuplicateCode", $"A price is already set for cloth code '{command.ClothCode}'."));
        }

        var clothPrice = ClothPrice.Create(command.ClothCode, command.ClothName, command.CostPrice, command.SellingPrice);

        _clothPriceRepository.Add(clothPrice);
        await _clothPriceRepository.SaveChangesAsync(cancellationToken);

        return clothPrice.ToDto();
    }
}
