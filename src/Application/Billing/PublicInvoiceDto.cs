namespace MathilensERP.Application.Billing;

/// <summary>
/// An invoice as a customer may see it, reached by share token and nothing else.
///
/// <para>A deliberately separate shape from <see cref="InvoiceDto"/> rather than a reuse of it.
/// This one crosses an anonymous endpoint, so every field on it is a decision: there are no
/// identifiers here — not the invoice's, not the order's, not the customer's — no audit columns, no
/// status enums the shop uses internally, and no payment breakdown beyond what has been paid in
/// total. What is left is what is printed on a bill and handed over anyway.</para>
/// </summary>
public sealed record PublicInvoiceDto(
    string ShopName,
    string? ShopAddress,
    string? ShopContactNumber,
    string CustomerName,
    /// <summary>The ten national digits, as the customer would recite them — never the stored form.</summary>
    string CustomerPhoneNumber,
    string InvoiceNumber,
    DateTime InvoiceDateUtc,
    string OrderNumber,
    DateTime CollectionDateUtc,
    IReadOnlyList<PublicInvoiceItemDto> Items,
    decimal Subtotal,
    decimal TaxAmount,
    decimal DiscountAmount,
    decimal TotalAmount,
    decimal AmountPaid,
    decimal RemainingBalance);

/// <summary>
/// One garment line.
///
/// <para>There is no separate fabric figure here, and that is not an omission on this screen: an
/// order item stores one <c>UnitPrice</c> with the cloth folded into it (see the New Order page,
/// which does the folding and says why). Printing a "Fabric Cost" column would mean inventing the
/// split. When the order model records the two amounts separately this record gains a field and
/// the page gains a column.</para>
/// </summary>
public sealed record PublicInvoiceItemDto(
    string GarmentType,
    int Quantity,
    decimal UnitPrice,
    decimal LineTotal);
