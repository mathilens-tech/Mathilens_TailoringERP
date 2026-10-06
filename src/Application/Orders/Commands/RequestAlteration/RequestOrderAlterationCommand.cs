using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Orders.Commands.RequestAlteration;

/// <summary>
/// Takes a delivered order back for alteration — the customer's feedback on the fit, and what the
/// shop is charging to put it right.
///
/// <para>A command of its own rather than a status transition, because the reason is not optional:
/// <c>TransitionStatus</c> would move the order and record nothing about why, and "why" is the only
/// part of an alteration anyone reads afterwards.</para>
/// </summary>
/// <param name="ChargeAmount">
/// Usually zero — re-stitching the shop's own work is not billable. A figure rather than a flag
/// because a customer who changed their mind about a fit they approved may well be charged.
/// </param>
public sealed record RequestOrderAlterationCommand(
    Guid OrderId,
    string Reason,
    decimal ChargeAmount = 0m) : ICommand<Result<OrderDto>>;
