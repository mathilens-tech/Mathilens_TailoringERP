using MathilensERP.Domain.Marketing;

namespace MathilensERP.Application.Marketing;

/// <summary>Repository port for <see cref="Campaign"/> (01_ARCHITECTURE.md § 25.1 Repository Pattern).</summary>
public interface ICampaignRepository
{
    void Add(Campaign campaign);

    /// <summary>The aggregate with its recipients, for a command that mutates one of them.</summary>
    Task<Campaign?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>The campaign joined to its customers' names and numbers, for the view — or null if
    /// there is no such campaign.</summary>
    Task<CampaignDto?> GetDetailAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Every campaign as a summary, newest first. A shop runs a handful, so this is
    /// unpaginated.</summary>
    Task<IReadOnlyList<CampaignListItemDto>> ListAsync(CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
