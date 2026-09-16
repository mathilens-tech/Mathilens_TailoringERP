using MathilensERP.Application.Orders.Drafts;
using MathilensERP.Domain.Orders;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.Orders;

public class OrderDraftRepository : IOrderDraftRepository
{
    private readonly ApplicationDbContext _dbContext;

    public OrderDraftRepository(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Matched on the owner as well as the id, so a draft belonging to somebody else is simply not
    /// found. The alternative — fetch by id, then compare the owner in the handler — is the same
    /// check written where it is easy to forget on the next query that needs one.
    /// </summary>
    public Task<OrderDraft?> GetAsync(Guid id, Guid ownerUserId, CancellationToken cancellationToken) =>
        _dbContext.OrderDrafts.SingleOrDefaultAsync(
            d => d.Id == id && d.OwnerUserId == ownerUserId, cancellationToken);

    public async Task<IReadOnlyList<OrderDraft>> ListForOwnerAsync(Guid ownerUserId, int limit, CancellationToken cancellationToken) =>
        await _dbContext.OrderDrafts
            .Where(d => d.OwnerUserId == ownerUserId)
            // Most recently touched first. LastModifiedAtUtc is null until a draft has been saved a
            // second time, so CreatedAtUtc stands in — without the fallback every draft saved once
            // would sort below every draft saved twice, regardless of age.
            .OrderByDescending(d => d.LastModifiedAtUtc ?? d.CreatedAtUtc)
            .Take(limit)
            .ToListAsync(cancellationToken);

    /// <summary>
    /// Age is measured from the last save, not from creation — a draft worked on this morning and
    /// created last week is live, and one created an hour ago and abandoned since is still an hour
    /// old. LastModifiedAtUtc is null until the second save, so CreatedAtUtc stands in.
    /// </summary>
    public async Task<IReadOnlyList<OrderDraft>> ListExpiredAsync(DateTime cutoffUtc, int limit, CancellationToken cancellationToken) =>
        await _dbContext.OrderDrafts
            .Where(d => (d.LastModifiedAtUtc ?? d.CreatedAtUtc) < cutoffUtc)
            .OrderBy(d => d.LastModifiedAtUtc ?? d.CreatedAtUtc)
            .Take(limit)
            .ToListAsync(cancellationToken);

    public void Add(OrderDraft draft) => _dbContext.OrderDrafts.Add(draft);

    public void Remove(OrderDraft draft) => _dbContext.OrderDrafts.Remove(draft);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        _dbContext.SaveChangesAsync(cancellationToken);
}
