using MathilensERP.Application.Measurements;
using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Pagination;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.Measurements;

public class MeasurementRepository : IMeasurementRepository
{
    private readonly ApplicationDbContext _dbContext;

    public MeasurementRepository(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<Measurement?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        _dbContext.Measurements.SingleOrDefaultAsync(m => m.Id == id, cancellationToken);

    public Task<bool> ExistsForCustomerAndGarmentTypeAsync(Guid customerId, string garmentType, CancellationToken cancellationToken) =>
        _dbContext.Measurements.AnyAsync(m => m.CustomerId == customerId && m.GarmentType == garmentType, cancellationToken);

    public async Task<IReadOnlyList<Measurement>> GetByCustomerAsync(Guid customerId, CancellationToken cancellationToken) =>
        await _dbContext.Measurements
            .Where(m => m.CustomerId == customerId)
            .OrderBy(m => m.GarmentType)
            .ToListAsync(cancellationToken);

    public async Task<PagedResult<MeasurementHistory>> GetHistoryAsync(Guid measurementId, int page, int pageSize, CancellationToken cancellationToken)
    {
        var query = _dbContext.MeasurementHistory.Where(h => h.MeasurementId == measurementId);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(h => h.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<MeasurementHistory>(items, page, pageSize, totalCount);
    }

    public void Add(Measurement measurement) => _dbContext.Measurements.Add(measurement);

    public void AddHistory(MeasurementHistory history) => _dbContext.MeasurementHistory.Add(history);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);
}
