using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Activity;

/// <summary>
/// One record of something a user did. Insert-only and never edited or soft-deleted — an audit
/// trail that could be changed after the fact would not be worth keeping, so it deliberately
/// carries neither the audit footprint nor the soft-delete flag every other entity has.
///
/// <see cref="UserName"/> is copied in rather than joined on read: the log has to stay readable
/// after a staff member's login is renamed or removed, and it records who acted <em>at the time</em>.
/// </summary>
public sealed class ActivityLog
{
    public Guid Id { get; private set; }

    public Guid? UserId { get; private set; }

    /// <summary>Who acted, as they were known at the time. Null for anything the system did unattended.</summary>
    public string? UserName { get; private set; }

    /// <summary>The area of the app the action belongs to — "Customers", "Orders" — and what the screen filter matches on.</summary>
    public string Screen { get; private set; } = string.Empty;

    /// <summary>What was done, in words: "Create Customer", "Transition Order Status".</summary>
    public string Action { get; private set; } = string.Empty;

    /// <summary>The command type behind the action, kept for tracing back to code when a log entry is disputed.</summary>
    public string RequestName { get; private set; } = string.Empty;

    /// <summary>
    /// The details the action carried, in words — "Full Name: Asha Rao, Phone Number: 98765 43210" —
    /// so the trail says what changed, not merely that something did. Null for entries recorded
    /// before this existed, and for actions whose command carried nothing worth repeating.
    /// </summary>
    public string? Description { get; private set; }

    /// <summary>
    /// What each edited field was before and what it became, as JSON — the shape of
    /// <c>EntityChange</c> in Application. Null for a create or a delete, which have only one side,
    /// and for entries recorded before this existed.
    ///
    /// Held as JSON rather than as its own table because it is written once, read whole, and never
    /// queried by field. A table would buy nothing and cost a join on the app's fastest-growing log.
    /// </summary>
    public string? Changes { get; private set; }

    public DateTime OccurredAtUtc { get; private set; }

    private ActivityLog()
    {
        // Reserved for EF Core materialization.
    }

    public static ActivityLog Record(
        Guid? userId,
        string? userName,
        string screen,
        string action,
        string requestName,
        DateTime occurredAtUtc,
        string? description = null,
        string? changes = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            UserName = userName,
            Screen = Guard.AgainstNullOrWhiteSpace(screen, nameof(screen)),
            Action = Guard.AgainstNullOrWhiteSpace(action, nameof(action)),
            RequestName = Guard.AgainstNullOrWhiteSpace(requestName, nameof(requestName)),
            OccurredAtUtc = occurredAtUtc,
            Description = string.IsNullOrWhiteSpace(description) ? null : description,
            Changes = string.IsNullOrWhiteSpace(changes) ? null : changes,
        };
}
