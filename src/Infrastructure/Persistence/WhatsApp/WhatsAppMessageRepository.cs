using MathilensERP.Application.WhatsApp;
using MathilensERP.Domain.WhatsApp;
using MathilensERP.Shared.Pagination;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.WhatsApp;

public class WhatsAppMessageRepository : IWhatsAppMessageRepository
{
    private readonly ApplicationDbContext _dbContext;

    public WhatsAppMessageRepository(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<WhatsAppMessage?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        _dbContext.WhatsAppMessages.SingleOrDefaultAsync(m => m.Id == id, cancellationToken);

    public async Task<PagedResult<WhatsAppMessage>> SearchAsync(
        Guid? customerId, Guid? orderId, WhatsAppMessageStatus? status, int page, int pageSize, CancellationToken cancellationToken)
    {
        var query = _dbContext.WhatsAppMessages.AsQueryable();

        if (customerId is { } cId)
        {
            query = query.Where(m => m.CustomerId == cId);
        }

        if (orderId is { } oId)
        {
            query = query.Where(m => m.OrderId == oId);
        }

        if (status is { } s)
        {
            query = query.Where(m => m.Status == s);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(m => m.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<WhatsAppMessage>(items, page, pageSize, totalCount);
    }

    public void Add(WhatsAppMessage message) => _dbContext.WhatsAppMessages.Add(message);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);
}
