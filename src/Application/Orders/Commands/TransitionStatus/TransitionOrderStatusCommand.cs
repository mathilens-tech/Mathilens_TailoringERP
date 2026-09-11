using MathilensERP.Application.Common.Mediator;
using MathilensERP.Application.Orders;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.TransitionStatus;

/// <summary><paramref name="DeliveredAtUtc"/> is required when — and only meaningful when — <paramref name="TargetStatus"/> is <see cref="OrderStatus.Delivered"/>.</summary>
public sealed record TransitionOrderStatusCommand(Guid OrderId, OrderStatus TargetStatus, DateTime? DeliveredAtUtc = null) : ICommand<Result<OrderDto>>;
