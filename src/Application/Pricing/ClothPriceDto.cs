namespace MathilensERP.Application.Pricing;

public sealed record ClothPriceDto(Guid Id, string ClothCode, string ClothName, decimal CostPrice, decimal SellingPrice, DateTime CreatedAtUtc);
