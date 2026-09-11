namespace MathilensERP.Application.Activity;

/// <summary>
/// One field of one row, as it was and as it became — "Customer / Phone Number / 98765 43210 →
/// 91234 56789".
/// </summary>
/// <param name="Entity">The record that changed, in words: "Customer", "Order Item".</param>
/// <param name="Field">The field, worded as the rest of the trail words it.</param>
/// <param name="From">The value before. Null where there wasn't one, which the screen shows as empty.</param>
/// <param name="To">The value after. Null where the field was cleared.</param>
public sealed record EntityChange(string Entity, string Field, string? From, string? To);

/// <summary>
/// Collects the field-level changes made during a request so the activity trail can record them.
///
/// Needed because the two halves happen at different moments: the before-and-after only exists on
/// the change tracker while <c>SaveChanges</c> is running, and the trail is written afterwards, by
/// which time the tracker has accepted the values and forgotten what they were. The interceptor
/// puts them here on the way past; <c>ActivityLogBehavior</c> takes them out.
///
/// Scoped to the request. One request may save more than once, so changes accumulate until drained.
/// </summary>
public interface IEntityChangeCollector
{
    void Record(IEnumerable<EntityChange> changes);

    /// <summary>Returns what has been collected and empties the collector, so one command's changes can never be attributed to the next.</summary>
    IReadOnlyList<EntityChange> Drain();
}
