using MathilensERP.Application.Common.Interfaces;
using MathilensERP.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MathilensERP.Infrastructure.Persistence.Billing;

/// <summary>
/// Hands out invoice numbers that restart at 0001 every January.
///
/// <para>
/// A counter row per year rather than a Postgres sequence, which is what order numbers use. A
/// sequence cannot be reset from under concurrent callers safely, and "reset it on the first
/// invoice of the new year" is exactly the kind of read-then-write two tills can perform at the
/// same moment. One statement does the whole job here instead: the insert claims the year if it is
/// new, the conflict clause increments it if it is not, and Postgres returns the value to exactly
/// one caller either way. No lock, no retry, no window.
/// </para>
///
/// <para>
/// The cost is the same as a sequence's: a number is spent whether or not the invoice that took it
/// is saved, so the series can have gaps. That is the right way round — a missing number is a
/// curiosity, a duplicated one is an argument at the counter with two customers holding the same
/// reference.
/// </para>
/// </summary>
public sealed class InvoiceNumberGenerator : IInvoiceNumberGenerator
{
    /// <summary>Created by the AddInvoiceNumbers migration, which also seeds it past the backfill.</summary>
    internal const string CounterTable = "InvoiceNumberCounters";

    /// <summary>
    /// Used until the shop sets its own on Settings → Invoice Settings. An invoice raised before
    /// anyone visits that screen still needs a reference, and INV-2026-0007 is serviceable.
    /// </summary>
    public const string FallbackPrefix = "INV";

    /// <summary>
    /// Four digits, so a year's invoices sort and read as a block. Past 9999 it widens to five
    /// rather than wrapping — an ugly number beats a repeated one.
    /// </summary>
    private const string CountFormat = "0000";

    private readonly ApplicationDbContext _dbContext;

    public InvoiceNumberGenerator(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<string> NextAsync(CancellationToken cancellationToken)
    {
        var configured = await _dbContext.Settings
            .Where(s => s.Key == SettingKeys.InvoiceNumberPrefix)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(cancellationToken);

        var prefix = string.IsNullOrWhiteSpace(configured) ? FallbackPrefix : configured.Trim().ToUpperInvariant();

        // UTC, matching the invoice's own CreatedAtUtc — the number and the date on the slip are
        // then read off the same clock. A few hours either side of midnight on 31 December they can
        // still disagree with a shop's local date; that is a New Year's Eve curiosity, not a defect
        // worth a second clock to avoid.
        var year = DateTime.UtcNow.Year;

        var count = await NextCountForYearAsync(year, cancellationToken);

        return $"{prefix}-{year}-{count.ToString(CountFormat)}";
    }

    /// <summary>
    /// Claims the year's next number in a single statement. Executed without composing any LINQ
    /// operator onto it, so EF sends it verbatim — wrapping a data-modifying statement in the
    /// subquery that composition produces would not be valid Postgres.
    /// </summary>
    private async Task<int> NextCountForYearAsync(int year, CancellationToken cancellationToken)
    {
        var counts = await _dbContext.Database
            .SqlQueryRaw<int>(
                $"""
                 INSERT INTO "{CounterTable}" ("Year", "LastNumber")
                 VALUES (@year, 1)
                 ON CONFLICT ("Year") DO UPDATE SET "LastNumber" = "{CounterTable}"."LastNumber" + 1
                 RETURNING "LastNumber" AS "Value"
                 """,
                new NpgsqlParameter("year", year))
            .ToListAsync(cancellationToken);

        return counts.Single();
    }
}
