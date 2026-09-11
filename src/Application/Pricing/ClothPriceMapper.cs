using MathilensERP.Domain.Pricing;

namespace MathilensERP.Application.Pricing;

internal static class ClothPriceMapper
{
    public static ClothPriceDto ToDto(this ClothPrice clothPrice) =>
        new(clothPrice.Id, clothPrice.ClothCode, clothPrice.ClothName, clothPrice.CostPrice, clothPrice.SellingPrice, clothPrice.CreatedAtUtc);
}
