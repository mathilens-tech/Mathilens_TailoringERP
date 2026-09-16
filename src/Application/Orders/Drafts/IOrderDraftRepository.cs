using MathilensERP.Domain.Orders;

namespace MathilensERP.Application.Orders.Drafts;

/// <summary>
/// Reads and writes unfinished orders.
///
/// <para>Every method takes the owner alongside the id. A draft is working state belonging to one
/// person, and passing the owner in means "not yours" and "not there" are the same answer — there
/// is no call shape here that can fetch somebody else's draft by guessing its id.</para>
/// </summary>
public interface IOrderDraftRepository
{
    Task<OrderDraft?> GetAsync(Guid id, Guid ownerUserId, CancellationToken cancellationToken);

    /// <summary>This person's drafts, most recently touched first.</summary>
    Task<IReadOnlyList<OrderDraft>> ListForOwnerAsync(Guid ownerUserId, int limit, CancellationToken cancellationToken);

    /// <summary>
    /// Drafts untouched since <paramref name="cutoffUtc"/>, across every owner.
    ///
    /// <para>Not scoped to one person, unlike everything else here. An expired draft is rubbish
    /// whoever left it, and a sweep that only ever cleared the drafts of whoever happened to open
    /// the screen would leave a departed member of staff's behind for good.</para>
    /// </summary>
    Task<IReadOnlyList<OrderDraft>> ListExpiredAsync(DateTime cutoffUtc, int limit, CancellationToken cancellationToken);

    void Add(OrderDraft draft);

    void Remove(OrderDraft draft);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
