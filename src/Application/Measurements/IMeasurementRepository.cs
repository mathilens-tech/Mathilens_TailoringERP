using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Pagination;

namespace MathilensERP.Application.Measurements;

/// <summary>
/// Repository port for the <see cref="Measurement"/> aggregate, including its
/// <see cref="MeasurementHistory"/> child records (01_ARCHITECTURE.md § 25.1 Repository Pattern).
/// </summary>
public interface IMeasurementRepository
{
    Task<Measurement?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<bool> ExistsForCustomerAndGarmentTypeAsync(Guid customerId, string garmentType, CancellationToken cancellationToken);

    Task<IReadOnlyList<Measurement>> GetByCustomerAsync(Guid customerId, CancellationToken cancellationToken);

    Task<PagedResult<MeasurementHistory>> GetHistoryAsync(Guid measurementId, int page, int pageSize, CancellationToken cancellationToken);

    void Add(Measurement measurement);

    void AddHistory(MeasurementHistory history);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
