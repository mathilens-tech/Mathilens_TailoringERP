namespace MathilensERP.Api.Contracts.Orders;

/// <summary>
/// The customer's feedback on a delivered garment, and what the shop is charging to put it right.
/// <c>ChargeAmount</c> defaults to zero — re-stitching the shop's own work is not billable.
/// </summary>
public sealed record RequestOrderAlterationRequest(string Reason, decimal ChargeAmount = 0m);
