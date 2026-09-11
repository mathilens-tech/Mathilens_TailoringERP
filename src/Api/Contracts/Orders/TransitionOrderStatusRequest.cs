using MathilensERP.Domain.Orders;

namespace MathilensERP.Api.Contracts.Orders;

/// <summary><paramref name="DeliveredAtUtc"/> is required when <paramref name="TargetStatus"/> is <see cref="OrderStatus.Delivered"/>, and ignored otherwise.</summary>
public sealed record TransitionOrderStatusRequest(OrderStatus TargetStatus, DateTime? DeliveredAtUtc = null);
