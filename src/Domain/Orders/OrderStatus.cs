namespace MathilensERP.Domain.Orders;

/// <summary>
/// An order's lifecycle status (02_DATABASE.md § 10.7). Enforced by
/// <see cref="Order.CanTransitionTo"/>: <c>Received → InProgress → ReadyForDelivery → Delivered</c>,
/// with cancellation allowed from any of the first three.
///
/// <para>Forward-only apart from one loop. A delivered garment that does not fit comes back, so
/// <c>Delivered → Alteration → InProgress</c> returns it to the workbench — see
/// <see cref="Alteration"/>. <c>Cancelled</c> and <c>Sold</c> are the only terminal states.</para>
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
    Sold,

    /// <summary>
    /// The customer has the garment, it does not fit, and it is coming back to be altered.
    ///
    /// <para>The one state reachable from <see cref="Delivered"/>, and the reason Delivered is no
    /// longer terminal. A shop that has handed over a shirt with a long sleeve has not finished the
    /// job, and the alternative to admitting that in the lifecycle was staff raising a second order
    /// for work the first one was paid for.</para>
    ///
    /// <para>Non-terminal, so <see cref="Order.IsOpen"/> is true here — which is what makes the
    /// order editable again so the measurements can be corrected. The tailor moves it on to
    /// <see cref="InProgress"/> when they pick it up.</para>
    ///
    /// <para>Appended for the same reason as <see cref="Sold"/>: the column holds the name, so this
    /// costs no migration of existing rows.</para>
    /// </summary>
    Alteration
}
