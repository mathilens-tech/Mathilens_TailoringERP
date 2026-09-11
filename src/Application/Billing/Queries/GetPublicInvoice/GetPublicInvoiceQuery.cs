using MathilensERP.Application.Common.Mediator;
using MathilensERP.Shared.Results;

namespace MathilensERP.Application.Billing.Queries.GetPublicInvoice;

/// <summary>
/// The invoice behind a share token, for the read-only page a customer opens from WhatsApp.
///
/// <para>Takes the token, not an id: the endpoint that serves this is anonymous, and an id
/// parameter would make it an invoice-enumeration endpoint the moment anyone noticed.</para>
/// </summary>
public sealed record GetPublicInvoiceQuery(string Token) : IQuery<Result<PublicInvoiceDto>>;
