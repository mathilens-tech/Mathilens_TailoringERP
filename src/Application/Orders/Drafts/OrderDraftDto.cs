namespace MathilensERP.Application.Orders.Drafts;

/// <summary>
/// An unfinished order, as the Resume list and the New Order screen read it.
///
/// <para><see cref="Payload"/> is the form's own JSON and is opaque to everything on the server.
/// It is carried through untouched: the screen that wrote it is the only thing that understands
/// it, and anything here that tried to interpret it would be a second definition of the form to
/// keep in step with the first.</para>
/// </summary>
public sealed record OrderDraftDto(
    Guid Id,
    string Kind,
    Guid? CustomerId,
    /// <summary>One line naming the draft, so the list is readable without opening anything.</summary>
    string Summary,
    string Payload,
    DateTime CreatedAtUtc,
    DateTime? LastModifiedAtUtc);

/// <summary>The list view, which deliberately omits the payload — see <see cref="OrderDraftDto"/>.</summary>
public sealed record OrderDraftSummaryDto(
    Guid Id,
    string Kind,
    Guid? CustomerId,
    string Summary,
    DateTime CreatedAtUtc,
    DateTime? LastModifiedAtUtc);
