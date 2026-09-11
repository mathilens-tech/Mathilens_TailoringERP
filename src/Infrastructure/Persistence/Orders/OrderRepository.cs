using MathilensERP.Application.Orders;
using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Pagination;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.Orders;

public class OrderRepository : IOrderRepository
{
    private readonly ApplicationDbContext _dbContext;

    public OrderRepository(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<Order?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        Include(_dbContext.Orders).SingleOrDefaultAsync(o => o.Id == id, cancellationToken);

    public async Task<PagedResult<Order>> SearchAsync(
        Guid? customerId,
        OrderStatus? status,
        string? searchTerm,
        string? garmentType,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = Include(_dbContext.Orders);

        if (customerId is { } id)
        {
            query = query.Where(o => o.CustomerId == id);
        }

        if (status is { } s)
        {
            query = query.Where(o => o.Status == s);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = $"%{searchTerm.Trim()}%";

            // Phone numbers are stored as they were typed — "+91 98765 43210" — and nobody searching
            // reproduces the spacing. Both sides are stripped so the digits match however either was
            // written; "9876543210" then finds "+91 98765 43210".
            var digits = $"%{searchTerm.Replace(" ", string.Empty).Replace("-", string.Empty).Trim()}%";

            // Correlated rather than joined, because Order holds no navigation to Customer — the
            // configuration maps the foreign key alone. EF turns this into an EXISTS, which is the
            // right shape anyway: one row per order, no duplicates to distinct away.
            query = query.Where(o =>
                EF.Functions.ILike(o.OrderNumber, term) ||
                _dbContext.Customers.Any(c =>
                    c.Id == o.CustomerId &&
                    (EF.Functions.ILike(c.FullName, term) ||
                     EF.Functions.ILike(c.PhoneNumber.Replace(" ", string.Empty).Replace("-", string.Empty), digits))));
        }

        if (!string.IsNullOrWhiteSpace(garmentType))
        {
            // Compared lowered rather than with ILike: a garment is named by the shop, and a name
            // holding % or _ would otherwise be read as a wildcard and match garments it is not.
            var garment = garmentType.Trim().ToLower();

            query = query.Where(o => o.Items.Any(i => i.GarmentType.ToLower() == garment));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(o => o.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Order>(items, page, pageSize, totalCount);
    }

    public Task<bool> ExistsForCustomerAsync(Guid customerId, CancellationToken cancellationToken) =>
        _dbContext.Orders.AnyAsync(o => o.CustomerId == customerId, cancellationToken);

    public Task<bool> ExistsForEmployeeAsync(Guid employeeId, CancellationToken cancellationToken) =>
        _dbContext.Orders.AnyAsync(o => o.EmployeeId == employeeId, cancellationToken);

    public async Task<PagedResult<(Order Order, string CustomerName)>> SearchByEmployeeAsync(
        Guid employeeId,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = Include(_dbContext.Orders).Where(o => o.EmployeeId == employeeId);

        var totalCount = await query.CountAsync(cancellationToken);

        // The customer name is joined in the same round trip rather than fetched per order —
        // this list is read a page at a time and would otherwise be one query per row.
        var rows = await query
            .OrderByDescending(o => o.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new
            {
                Order = o,
                CustomerName = _dbContext.Customers
                    .Where(c => c.Id == o.CustomerId)
                    .Select(c => c.FullName)
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        // A deleted customer leaves the order in the history rather than dropping it — the work
        // still happened, and the tailor's record of it should not silently shrink.
        var items = rows
            .Select(row => (row.Order, CustomerName: row.CustomerName ?? "(customer removed)"))
            .ToList();

        return new PagedResult<(Order, string)>(items, page, pageSize, totalCount);
    }

    /// <summary>Joins through Customers on the phone number, so orders placed under a duplicate customer record are found too.</summary>
    public async Task<IReadOnlyList<Order>> GetByCustomerPhoneAsync(string phoneNumber, Guid excludingOrderId, CancellationToken cancellationToken) =>
        await Include(_dbContext.Orders)
            .Where(o => o.Id != excludingOrderId
                && _dbContext.Customers.Any(c => c.Id == o.CustomerId && c.PhoneNumber == phoneNumber))
            .OrderByDescending(o => o.CreatedAtUtc)
            .ToListAsync(cancellationToken);

    public void Add(Order order) => _dbContext.Orders.Add(order);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => _dbContext.SaveChangesAsync(cancellationToken);

    private static IQueryable<Order> Include(IQueryable<Order> query) =>
        query.Include(o => o.Items).ThenInclude(i => i.Fabric);
}
