using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Pricing;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Pricing.Queries.ListAll;

/// <summary>Every cloth price, unpaginated — backs the spreadsheet export.</summary>
public sealed record ListAllClothPricesQuery : IQuery<Result<IReadOnlyList<ClothPriceDto>>>;
