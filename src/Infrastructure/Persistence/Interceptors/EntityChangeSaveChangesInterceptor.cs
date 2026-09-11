using MathilensERP.Application.Activity;
using MathilensERP.Domain.Activity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace MathilensERP.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Captures what each edit actually changed — the value before and the value after — so the
/// activity trail can say "Phone Number: 98765 43210 → 91234 56789" rather than only what the
/// command carried.
///
/// Read off the change tracker during <c>SaveChanges</c>, which is the one moment both values
/// exist: before it the new value has not been applied, and after it EF has accepted the change
/// and the original is gone. Handed to <see cref="IEntityChangeCollector"/> for the activity
/// behaviour to pick up once the command has committed.
///
/// Sitting here rather than in the handlers means every entity is covered by the same code, and an
/// entity added next month is covered the day it is written — the same argument that put the audit
/// footprint in an interceptor.
/// </summary>
public class EntityChangeSaveChangesInterceptor : SaveChangesInterceptor
{
    /// <summary>
    /// Columns whose changing says nothing a reader wants: the audit footprint moves on every
    /// single edit, and the soft-delete flag only ever repeats what the action already says.
    /// </summary>
    private static readonly HashSet<string> IgnoredProperties = new(StringComparer.Ordinal)
    {
        "CreatedAtUtc", "CreatedBy", "LastModifiedAtUtc", "LastModifiedBy",
        "IsDeleted", "DeletedAtUtc", "DeletedBy",
    };

    /// <summary>
    /// Enough to describe any real edit. A bulk operation touching more than this is not something
    /// a person reads field by field, and an audit row is not the place to find out.
    /// </summary>
    private const int MaxChanges = 25;

    /// <summary>Long free text — an order's notes — is recorded as evidence, not reproduced whole.</summary>
    private const int MaxValueLength = 200;

    private readonly IEntityChangeCollector _collector;

    public EntityChangeSaveChangesInterceptor(IEntityChangeCollector collector)
    {
        _collector = collector;
    }

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Capture(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Capture(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void Capture(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var changes = new List<EntityChange>();

        foreach (var entry in context.ChangeTracker.Entries())
        {
            // The trail writing itself is not an event in the trail.
            if (entry.Entity is ActivityLog || entry.State != EntityState.Modified)
            {
                continue;
            }

            var entityName = ActivityValues.Humanize(entry.Metadata.ClrType.Name);

            foreach (var property in entry.Properties)
            {
                if (changes.Count >= MaxChanges)
                {
                    break;
                }

                var change = DescribeChange(entityName, property);
                if (change is not null)
                {
                    changes.Add(change);
                }
            }
        }

        if (changes.Count > 0)
        {
            _collector.Record(changes);
        }
    }

    private static EntityChange? DescribeChange(string entityName, PropertyEntry property)
    {
        var name = property.Metadata.Name;

        if (!property.IsModified || IgnoredProperties.Contains(name))
        {
            return null;
        }

        // xmin and friends move on every write by definition and mean nothing to a reader.
        if (property.Metadata.IsConcurrencyToken)
        {
            return null;
        }

        if (ActivityValues.IsSecret(name))
        {
            // Recorded, but only that it changed. A password's old value is the last thing an
            // audit table should be holding.
            return new EntityChange(entityName, ActivityValues.Humanize(name), ActivityValues.Redacted, ActivityValues.Redacted);
        }

        var from = Clip(ActivityValues.Format(property.OriginalValue));
        var to = Clip(ActivityValues.Format(property.CurrentValue));

        // EF marks a property modified on assignment, not on difference — setting a field to what
        // it already held would otherwise produce "Asha Rao → Asha Rao".
        return from == to ? null : new EntityChange(entityName, ActivityValues.Humanize(name), from, to);
    }

    private static string? Clip(string? value) =>
        value is { Length: > MaxValueLength } ? value[..(MaxValueLength - 1)] + "…" : value;
}
