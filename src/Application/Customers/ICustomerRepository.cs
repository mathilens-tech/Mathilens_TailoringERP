using MathilensERP.Domain.Customers;
using MathilensERP.Shared.Pagination;

namespace MathilensERP.Application.Customers;

/// <summary>
/// Repository port for the <see cref="Customer"/> aggregate (01_ARCHITECTURE.md § 25.1
/// Repository Pattern), implemented in Infrastructure against EF Core/PostgreSQL.
/// Exposes <see cref="SaveChangesAsync"/> directly rather than a separate Unit of Work
/// abstraction, per 01_ARCHITECTURE.md § 25.7 — one command handler, one commit.
/// </summary>
public interface ICustomerRepository
{
    Task<Customer?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<PagedResult<Customer>> SearchAsync(string? searchTerm, Religion? religion, int page, int pageSize, CancellationToken cancellationToken);

    /// <summary>Every customer, unpaginated — for spreadsheet export, which has no page to scroll.</summary>
    Task<IReadOnlyList<Customer>> ListAllAsync(CancellationToken cancellationToken);

    /// <summary>Exact match on the phone number, the natural key spreadsheet imports upsert against.</summary>
    Task<Customer?> GetByPhoneNumberAsync(string phoneNumber, CancellationToken cancellationToken);

    /// <summary>
    /// The customer holding this email, if one does — case-insensitively, since an address is the
    /// same address whatever case it was typed in.
    /// </summary>
    Task<Customer?> GetByEmailAsync(string email, CancellationToken cancellationToken);

    /// <summary>
    /// Customers who already hold this number or this email — what the counter is warned about
    /// before a second record for the same person is created.
    ///
    /// <para>The phone must already be normalized; matching is exact on it and case-insensitive
    /// on email. <paramref name="excludeId"/> keeps a customer being edited from being reported
    /// as its own duplicate. Bounded, because one family email can be on many customers and the
    /// warning only needs to show that it is taken.</para>
    /// </summary>
    Task<IReadOnlyList<Customer>> FindPotentialDuplicatesAsync(
        string? phoneNumber,
        string? email,
        Guid? excludeId,
        CancellationToken cancellationToken);

    void Add(Customer customer);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
