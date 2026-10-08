using MathilensERP.Application.Marketing;
using MathilensERP.Domain.Marketing;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.Marketing;

public class CampaignRepository : ICampaignRepository
{
    private readonly ApplicationDbContext _dbContext;

    public CampaignRepository(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public void Add(Campaign campaign) => _dbContext.Campaigns.Add(campaign);

    public Task<Campaign?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        _dbContext.Campaigns
            .Include(c => c.Recipients)
            .SingleOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task<CampaignDto?> GetDetailAsync(Guid id, CancellationToken cancellationToken)
    {
        var campaign = await _dbContext.Campaigns
            .Include(c => c.Recipients)
            .SingleOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (campaign is null)
        {
            return null;
        }

        // The recipients carry only a customer id; their names and numbers are read in one query and
        // matched up here, rather than a lookup per row. A customer deleted since the campaign was
        // made still appears — the campaign recorded that they were on it — with the name said plainly.
        var customerIds = campaign.Recipients.Select(r => r.CustomerId).ToList();
        var customers = await _dbContext.Customers
            .Where(c => customerIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => new { c.FullName, c.PhoneNumber }, cancellationToken);

        var recipients = campaign.Recipients
            .Select(r =>
            {
                customers.TryGetValue(r.CustomerId, out var customer);
                return new CampaignRecipientDto(
                    r.Id,
                    r.CustomerId,
                    customer?.FullName ?? "(deleted customer)",
                    customer?.PhoneNumber ?? string.Empty,
                    r.IsMessaged,
                    r.MessagedAtUtc);
            })
            // Alphabetical, so the list reads the same on every visit and the operator can find where
            // they are in it.
            .OrderBy(r => r.CustomerName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new CampaignDto(campaign.Id, campaign.Name, campaign.MessageTemplate, campaign.CreatedAtUtc, recipients);
    }

    public async Task<IReadOnlyList<CampaignListItemDto>> ListAsync(CancellationToken cancellationToken) =>
        await _dbContext.Campaigns
            .OrderByDescending(c => c.CreatedAtUtc)
            .Select(c => new CampaignListItemDto(
                c.Id,
                c.Name,
                c.Recipients.Count,
                c.Recipients.Count(r => r.MessagedAtUtc != null),
                c.CreatedAtUtc))
            .ToListAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);
}
