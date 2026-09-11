namespace MathilensERP.Api.Contracts.Pricing;

public sealed record CreateClothPriceRequest(string ClothCode, string ClothName, decimal CostPrice, decimal SellingPrice);
