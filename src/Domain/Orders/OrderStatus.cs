namespace MathilensERP.Domain.Orders;

/// <summary>
/// An order's lifecycle status (02_DATABASE.md § 10.7). A strict forward-only progression —
/// enforced by <see cref="Order.CanTransitionTo"/> — with cancellation allowed from any
/// non-terminal state: <c>Received → InProgress → ReadyForDelivery → Delivered</c>, or
/// any of the first three → <c>Cancelled</c>. <c>Delivered</c> and <c>Cancelled</c> are terminal.
/// </summary>
public enum OrderStatus
{
    Received,
    InProgress,
    ReadyForDelivery,
    Delivered,
    Cancelled,

    /// <summary>
    /// Cloth sold over the counter, with nothing to stitch.
    ///
    /// <para>Terminal from the moment it is created, and the only status a fabric-only sale ever
    /// holds. It is not part of the progression above and cannot be reached from it: a garment order
    /// is never "sold", and a length of cloth handed across the counter was never "received" to be
    /// worked on. Both are orders, and an invoice does not care which — but only one of them has a
    /// lifecycle.</para>
    ///
    /// <para>Added at the end, though the column stores the name rather than the number
    /// (character varying(50)), so no existing row is disturbed and no migration is needed.</para>
    /// </summary>
    Sold
}
