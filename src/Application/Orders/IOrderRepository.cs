using MathilensERP.Domain.Orders;
using MathilensERP.Shared.Pagination;

namespace MathilensERP.Application.Orders;

/// <summary>Repository port for the <see cref="Order"/> aggregate (01_ARCHITECTURE.md § 25.1 Repository Pattern) — includes its Items/Fabric on every read.</summary>
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <param name="searchTerm">Matched against the order number, the customer's name and their phone number. Null or blank matches everything.</param>
    /// <param name="garmentType">
    /// Keeps only orders with at least one item for this garment. Null or blank matches everything.
    /// Compared case-insensitively: names are normalised on the way in, but rows written before the
    /// garment list became the shop's own carry whatever casing the old enum used.
    /// </param>
    Task<PagedResult<Order>> SearchAsync(
        Guid? customerId,
        OrderStatus? status,
        string? searchTerm,
        string? garmentType,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    /// <summary>Whether any live order was placed by this customer — used to keep a customer with order history from being deleted.</summary>
    Task<bool> ExistsForCustomerAsync(Guid customerId, CancellationToken cancellationToken);

    /// <summary>Whether any live order is assigned to this employee — used to keep an employee with work history from being deleted.</summary>
    Task<bool> ExistsForEmployeeAsync(Guid employeeId, CancellationToken cancellationToken);

    /// <summary>
    /// The orders assigned to one employee, newest first — their work history. Includes the
    /// customer name, which the history is read by rather than a customer id.
    /// </summary>
    Task<PagedResult<(Order Order, string CustomerName)>> SearchByEmployeeAsync(
        Guid employeeId,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    /// <summary>
    /// Every live order placed by any customer sharing <paramref name="phoneNumber"/>, newest first,
    /// excluding <paramref name="excludingOrderId"/>. Matched on the phone rather than the customer
    /// id so a customer entered twice still shows one history.
    /// </summary>
    Task<IReadOnlyList<Order>> GetByCustomerPhoneAsync(string phoneNumber, Guid excludingOrderId, CancellationToken cancellationToken);

    void Add(Order order);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
