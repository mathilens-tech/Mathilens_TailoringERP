namespace MathilensERP.Api.Contracts.WhatsApp;

/// <summary>
/// What staff were sharing when they opened WhatsApp.
///
/// <param name="CustomerId">Who the message was addressed to.</param>
/// <param name="OrderNumber">The shop's reference, as it appears in the message — "MTL-0007".</param>
/// <param name="InvoiceNumber">The invoice reference — "INV-2026-0001".</param>
///
/// <para>The two references travel as the text a person reads rather than as ids: this ends up in
/// the Activity Log, where a row saying "Order MTL-0007" can be acted on and a row carrying two
/// GUIDs cannot.</para>
/// </summary>
public sealed record RecordWhatsAppShareRequest(Guid CustomerId, string OrderNumber, string InvoiceNumber);
