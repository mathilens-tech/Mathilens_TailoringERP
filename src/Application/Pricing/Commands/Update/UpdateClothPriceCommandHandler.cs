using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Pricing;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Pricing.Commands.Update;

public sealed class UpdateClothPriceCommandHandler : ICommandHandler<UpdateClothPriceCommand, Result<ClothPriceDto>>
{
    private readonly IClothPriceRepository _clothPriceRepository;

    public UpdateClothPriceCommandHandler(IClothPriceRepository clothPriceRepository)
    {
        _clothPriceRepository = clothPriceRepository;
    }

    public async Task<Result<ClothPriceDto>> Handle(UpdateClothPriceCommand command, CancellationToken cancellationToken)
    {
        var clothPrice = await _clothPriceRepository.GetByIdAsync(command.Id, cancellationToken);
        if (clothPrice is null)
        {
            return Result.Failure<ClothPriceDto>(
                Error.NotFound("ClothPrice.NotFound", $"No price was found with id '{command.Id}'."));
        }

        var existing = await _clothPriceRepository.GetByClothCodeAsync(command.ClothCode, cancellationToken);
        if (existing is not null && existing.Id != command.Id)
        {
            return Result.Failure<ClothPriceDto>(
                Error.Conflict("ClothPrice.DuplicateCode", $"A price is already set for cloth code '{command.ClothCode}'."));
        }

        clothPrice.UpdateDetails(command.ClothCode, command.ClothName, command.CostPrice, command.SellingPrice);
        await _clothPriceRepository.SaveChangesAsync(cancellationToken);

        return clothPrice.ToDto();
    }
}
