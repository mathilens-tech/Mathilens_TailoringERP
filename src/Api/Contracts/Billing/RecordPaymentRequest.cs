using MathilensERP.Domain.Billing;

namespace MathilensERP.Api.Contracts.Billing;

public sealed record RecordPaymentRequest(decimal Amount, PaymentMethod Method);
