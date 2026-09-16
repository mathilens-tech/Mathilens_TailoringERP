namespace MathilensERP.Api.Contracts.Orders;

/// <summary>
/// An autosave of the New Order screen.
/// </summary>
/// <param name="Id">
/// The draft being replaced, or null on the first save of a form. The screen learns its id from the
/// response and sends it on every save afterwards.
/// </param>
/// <param name="Kind">Which New Order screen wrote this — fabric, tailoring or fabricTailoring.</param>
/// <param name="CustomerId">The chosen customer, or null while nobody has been chosen yet.</param>
/// <param name="Summary">One line naming the draft, so the Resume list reads without opening anything.</param>
/// <param name="Payload">
/// The form's own state as JSON. Stored and returned untouched: only the screen that wrote it knows
/// what is in it, and anything here that parsed it would be a second copy of the form's shape.
/// </param>
public sealed record SaveOrderDraftRequest(
    Guid? Id,
    string Kind,
    Guid? CustomerId,
    string Summary,
    string Payload);
