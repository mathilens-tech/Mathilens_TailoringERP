using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Pricing;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Pricing.Queries.GetById;

public sealed record GetClothPriceByIdQuery(Guid Id) : IQuery<Result<ClothPriceDto>>;
