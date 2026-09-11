using MathilensERP.Application.Customers;
using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Constants;
using MathilensERP.Shared.Pagination;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.Customers;

public class CustomerRepository : ICustomerRepository
{
    private readonly ApplicationDbContext _dbContext;

    public CustomerRepository(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<Customer?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        _dbContext.Customers.SingleOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task<PagedResult<Customer>> SearchAsync(string? searchTerm, Religion? religion, int page, int pageSize, CancellationToken cancellationToken)
    {
        var query = _dbContext.Customers.AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            query = query.Where(c => EF.Functions.ILike(c.FullName, $"%{searchTerm}%") || EF.Functions.ILike(c.PhoneNumber, $"%{searchTerm}%"));
        }

        if (religion is { } r)
        {
            query = query.Where(c => c.Religion == r);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(c => c.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Customer>(items, page, pageSize, totalCount);
    }

    public async Task<IReadOnlyList<Customer>> ListAllAsync(CancellationToken cancellationToken) =>
        await _dbContext.Customers.OrderBy(c => c.FullName).ToListAsync(cancellationToken);

    public Task<Customer?> GetByPhoneNumberAsync(string phoneNumber, CancellationToken cancellationToken) =>
        _dbContext.Customers.FirstOrDefaultAsync(c => c.PhoneNumber == phoneNumber, cancellationToken);

    public Task<Customer?> GetByEmailAsync(string email, CancellationToken cancellationToken)
    {
        // Lowered on both sides rather than matched with ILIKE, for the reason spelled out in
        // FindPotentialDuplicatesAsync below: an underscore is legal in an address and ILIKE would
        // read it as a wildcard.
        var lowered = email.Trim().ToLowerInvariant();
        return _dbContext.Customers.FirstOrDefaultAsync(
            c => c.Email != null && c.Email.ToLower() == lowered,
            cancellationToken);
    }

    public async Task<IReadOnlyList<Customer>> FindPotentialDuplicatesAsync(
        string? phoneNumber,
        string? email,
        Guid? excludeId,
        CancellationToken cancellationToken)
    {
        var phone = string.IsNullOrWhiteSpace(phoneNumber) ? null : phoneNumber.Trim();
        // Compared lowered on both sides rather than with ILIKE: an email may legitimately contain
        // an underscore, which ILIKE would read as a single-character wildcard and match addresses
        // that are not this one.
        var loweredEmail = string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();

        if (phone is null && loweredEmail is null)
        {
            return [];
        }

        var query = _dbContext.Customers.Where(c =>
            (phone != null && c.PhoneNumber == phone)
            || (loweredEmail != null && c.Email != null && c.Email.ToLower() == loweredEmail));

        if (excludeId is { } id)
        {
            query = query.Where(c => c.Id != id);
        }

        return await query
            .OrderBy(c => c.FullName)
            .Take(MaxDuplicatesReported)
            .ToListAsync(cancellationToken);
    }

    /// <summary>A warning, not a report — the operator needs to see that the detail is taken and by
    /// whom, and a shared family email must not turn that into an unbounded query.</summary>
    private const int MaxDuplicatesReported = 10;

    public void Add(Customer customer) => _dbContext.Customers.Add(customer);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);
}
