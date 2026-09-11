using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Shared.Constants;
using MathilensERP.Shared.Numbering;
using Microsoft.EntityFrameworkCore;

namespace MathilensERP.Infrastructure.Persistence.Orders;

/// <summary>
/// Hands out order numbers from a Postgres sequence.
///
/// <para>
/// A sequence rather than <c>MAX(number) + 1</c> or a counter row, because those are only correct
/// while one order is being taken at a time. Two staff finishing an order in the same second would
/// both read the same maximum and both write it; the shop would then have two orders answering to
/// the same reference, and no way to tell which receipt belongs to which garment. Postgres hands a
/// sequence value to exactly one caller, without a lock and without a retry.
/// </para>
///
/// <para>
/// The cost is gaps: a value is spent whether or not the order that took it is saved. That is the
/// right way round — a missing number is a curiosity, a duplicated one is a dispute at the counter.
/// </para>
/// </summary>
public sealed class OrderNumberGenerator : IOrderNumberGenerator
{
    /// <summary>Created by the AddOrderNumbers migration, which also seeds it past the backfill.</summary>
    internal const string SequenceName = "OrderNumberSequence";

    /// <summary>
    /// Used until the shop sets its own on Settings → Order Number. An order taken before anyone
    /// visits that screen still needs a reference, and one that reads ORDA-0007 is serviceable.
    /// </summary>
    public const string FallbackPrefix = "ORD";

    private readonly ApplicationDbContext _dbContext;

    public OrderNumberGenerator(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<string> NextAsync(CancellationToken cancellationToken)
    {
        var configured = await _dbContext.Settings
            .Where(s => s.Key == SettingKeys.OrderNumberPrefix)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(cancellationToken);

        var prefix = string.IsNullOrWhiteSpace(configured) ? FallbackPrefix : configured.Trim();

        // Quoted because the sequence is created with a capitalised name, matching every other
        // object in this schema; unquoted, Postgres would fold it to lower case and not find it.
        var count = await _dbContext.Database
            .SqlQueryRaw<long>("SELECT nextval('\"OrderNumberSequence\"') AS \"Value\"")
            .SingleAsync(cancellationToken);

        // The shape of the reference is OrderNumberFormat's business, not this class's: this one
        // only promises the count is unique, which is the part that needs a database.
        return OrderNumberFormat.Format(prefix, count);
    }
}
