using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Pricing;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Pricing.Commands.Update;

public sealed record UpdateClothPriceCommand(Guid Id, string ClothCode, string ClothName, decimal CostPrice, decimal SellingPrice) : ICommand<Result<ClothPriceDto>>;
