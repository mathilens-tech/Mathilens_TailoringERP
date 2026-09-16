using System.Text.Json;
using MathilensERP.Application.Activity;
using MathilensERP.Domain.Activity;

namespace MathilensERP.Application.Orders.Drafts;

/// <summary>
/// Throws away unfinished orders once they are a day old, recording each one in the activity log
/// before it goes.
///
/// <para><b>Why a day.</b> A draft is the counter's working state, not a record — it exists so that
/// walking away mid-order does not lose the work. Beyond a day it has stopped being that: the
/// customer has gone, the order was either written properly or abandoned, and what remains is a
/// half-typed row that will be resumed by mistake rather than on purpose. Keeping them for ever
/// would also mean a growing table of personal data nobody has any use for.</para>
///
/// <para><b>Why the log.</b> Discarding somebody's work automatically is the sort of thing that must
/// leave a trace, or the first question after it happens — "where did my order go?" — has no
/// answer. The entry carries the whole draft, payload included, so the order can be reconstructed
/// by hand if it turns out to have mattered.</para>
///
/// <para><b>Why here and not on a schedule.</b> This application has no background scheduler, so the
/// sweep runs when the drafts list is read. That means an installation nobody opens never expires
/// anything — acceptable, because an installation nobody opens has nothing accumulating either.
/// The sweep is global rather than per-user for the opposite reason: drafts left by somebody who
/// has since left the shop must still go.</para>
/// </summary>
public static class OrderDraftExpiry
{
    /// <summary>A day, as asked for. Measured from the last save rather than from creation.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(24);

    /// <summary>
    /// The most to clear in one pass.
    ///
    /// <para>A cap so that a shop returning from a long shutdown does not turn one screen load into
    /// a delete of thousands of rows while somebody waits. Whatever is left over goes on the next
    /// pass, which is the next time anybody opens the Orders screen.</para>
    /// </summary>
    private const int MaxPerSweep = 200;

    public static async Task SweepAsync(
        IOrderDraftRepository drafts,
        IActivityLogRepository activityLog,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var expired = await drafts.ListExpiredAsync(nowUtc - Lifetime, MaxPerSweep, cancellationToken);
        if (expired.Count == 0)
        {
            return;
        }

        foreach (var draft in expired)
        {
            await activityLog.AddAsync(
                ActivityLog.Record(
                    // Null user: nobody did this. The draft's own owner is named in the description
                    // instead, because attributing an automatic deletion to the person whose work
                    // was deleted would read as though they had discarded it themselves.
                    userId: null,
                    userName: null,
                    screen: "Orders",
                    action: "Discard Expired Order Draft",
                    requestName: nameof(OrderDraftExpiry),
                    occurredAtUtc: nowUtc,
                    description: Describe(draft, nowUtc),
                    // The whole draft, so the order can be rebuilt by hand if it turns out to have
                    // mattered. Changes rather than Description because it is JSON and is read
                    // whole — which is exactly what that column is for.
                    changes: Payload(draft)),
                cancellationToken);

            drafts.Remove(draft);
        }

        await drafts.SaveChangesAsync(cancellationToken);
    }

    /// <summary>The one line the activity list shows, without anybody opening the entry.</summary>
    private static string Describe(Domain.Orders.OrderDraft draft, DateTime nowUtc)
    {
        var lastTouched = draft.LastModifiedAtUtc ?? draft.CreatedAtUtc;
        var age = nowUtc - lastTouched;

        return $"Summary: {draft.Summary}, Kind: {draft.Kind}, "
            + $"Owner: {draft.OwnerUserId}, Customer: {draft.CustomerId?.ToString() ?? "none"}, "
            + $"Last saved: {lastTouched:yyyy-MM-dd HH:mm} UTC ({(int)age.TotalHours}h ago)";
    }

    /// <summary>
    /// The draft as JSON, with its form state nested rather than escaped inside a string.
    ///
    /// <para>The payload is already JSON. Writing it as a string value would give a log entry
    /// containing a wall of backslashes that nobody can read, so it is parsed and embedded — and if
    /// it will not parse, kept as text rather than losing it.</para>
    /// </summary>
    private static string Payload(Domain.Orders.OrderDraft draft)
    {
        object form;
        try
        {
            form = JsonDocument.Parse(draft.Payload).RootElement.Clone();
        }
        catch (JsonException)
        {
            form = draft.Payload;
        }

        return JsonSerializer.Serialize(new
        {
            draftId = draft.Id,
            ownerUserId = draft.OwnerUserId,
            kind = draft.Kind,
            customerId = draft.CustomerId,
            summary = draft.Summary,
            createdAtUtc = draft.CreatedAtUtc,
            lastModifiedAtUtc = draft.LastModifiedAtUtc,
            form,
        });
    }
}
