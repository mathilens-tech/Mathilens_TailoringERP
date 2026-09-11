namespace MathilensERP.Api.Contracts.Pricing;

public sealed record UpdateClothPriceRequest(string ClothCode, string ClothName, decimal CostPrice, decimal SellingPrice);
