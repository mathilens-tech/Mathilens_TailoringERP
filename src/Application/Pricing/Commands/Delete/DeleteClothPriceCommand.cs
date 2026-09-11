using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Pricing.Commands.Delete;

public sealed record DeleteClothPriceCommand(Guid Id) : ICommand<Result>;
