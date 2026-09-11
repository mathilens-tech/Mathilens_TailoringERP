using MathilensERP.Application.Employees;
using MathilensERP.Domain.Employees;
using MathilensERP.Shared.Pagination;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.Employees;

public class EmployeeRepository : IEmployeeRepository
{
    private readonly ApplicationDbContext _dbContext;

    public EmployeeRepository(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<Employee?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        _dbContext.Employees.SingleOrDefaultAsync(e => e.Id == id, cancellationToken);

    public async Task<PagedResult<Employee>> SearchAsync(string? searchTerm, int page, int pageSize, CancellationToken cancellationToken)
    {
        var query = _dbContext.Employees.AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            query = query.Where(e =>
                EF.Functions.ILike(e.FullName, $"%{searchTerm}%") ||
                EF.Functions.ILike(e.EmployeeCode, $"%{searchTerm}%") ||
                (e.PhoneNumber != null && EF.Functions.ILike(e.PhoneNumber, $"%{searchTerm}%")));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(e => e.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Employee>(items, page, pageSize, totalCount);
    }

    public async Task<IReadOnlyList<Employee>> ListAllAsync(CancellationToken cancellationToken) =>
        await _dbContext.Employees.OrderBy(e => e.FullName).ToListAsync(cancellationToken);

    public Task<Employee?> GetByPhoneNumberAsync(string phoneNumber, CancellationToken cancellationToken) =>
        _dbContext.Employees.FirstOrDefaultAsync(e => e.PhoneNumber == phoneNumber, cancellationToken);

    public Task<Employee?> GetByEmailAsync(string email, CancellationToken cancellationToken)
    {
        // Lowered on both sides rather than matched with ILIKE: an underscore is legal in an
        // address and ILIKE would read it as a single-character wildcard.
        var lowered = email.Trim().ToLowerInvariant();
        return _dbContext.Employees.FirstOrDefaultAsync(
            e => e.Email != null && e.Email.ToLower() == lowered,
            cancellationToken);
    }

    public Task<Employee?> GetByEmployeeCodeAsync(string employeeCode, CancellationToken cancellationToken) =>
        _dbContext.Employees.FirstOrDefaultAsync(e => EF.Functions.ILike(e.EmployeeCode, employeeCode), cancellationToken);

    public void Add(Employee employee) => _dbContext.Employees.Add(employee);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);
}
