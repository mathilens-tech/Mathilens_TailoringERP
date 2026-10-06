using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Orders;

/// <summary>
/// One time a delivered order came back to be altered — what the customer said was wrong, when they
/// had taken it, and what the shop charged to put it right.
///
/// <para>A record per alteration rather than fields on <see cref="Order"/>, because a garment can
/// come back twice. Fields would be overwritten by the second visit, and the history is the thing
/// worth having: a shirt altered three times is telling the shop something about the measurements it
/// took, and that is invisible if only the latest reason survives.</para>
///
/// <para>Not <see cref="AuditableEntity"/>/<see cref="ISoftDeletable"/> — this is an event that
/// happened, and an event is not edited or withdrawn. The <see cref="IAuditable"/> footprint says
/// who recorded it and when, which is all a log of events needs.</para>
/// </summary>
public sealed class OrderAlteration : IAuditable
{
    /// <summary>Long enough for the counter to write down what the customer actually said.</summary>
    public const int ReasonMaxLength = 1000;

    public Guid Id { get; private set; }

    public Guid OrderId { get; private set; }

    /// <summary>What needs putting right, in the customer's terms — "sleeve too long", "tight at the waist".</summary>
    public string Reason { get; private set; } = string.Empty;

    /// <summary>
    /// What the shop is charging for this alteration, which is usually nothing.
    ///
    /// <para>Zero by default and deliberately so: re-stitching the shop's own mistake is not
    /// billable. It is a figure rather than a flag because the other case is real — a customer who
    /// has changed their mind about a fit they approved may well be charged — and a shop that could
    /// not record that would raise a second order to collect it, which is exactly the workaround
    /// this whole state exists to remove.</para>
    /// </summary>
    public decimal ChargeAmount { get; private set; }

    /// <summary>
    /// When the customer had taken the garment before this alteration.
    ///
    /// <para>Kept because <see cref="Order.DeliveredAtUtc"/> is overwritten when the altered garment
    /// is handed over again — it answers "when did the customer get it", and after an alteration
    /// that is the later date. Without this the first hand-over would be lost, and with it the
    /// ability to say how long the customer had the garment before complaining.</para>
    /// </summary>
    public DateTime? PreviousDeliveredAtUtc { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public Guid CreatedBy { get; private set; }

    public DateTime? LastModifiedAtUtc { get; private set; }

    public Guid? LastModifiedBy { get; private set; }

    private OrderAlteration()
    {
        // Reserved for EF Core materialization.
    }

    internal static OrderAlteration Create(Guid orderId, string reason, decimal chargeAmount, DateTime? previousDeliveredAtUtc)
    {
        return new OrderAlteration
        {
            Id = Guid.NewGuid(),
            OrderId = Guard.AgainstEmpty(orderId, nameof(orderId)),
            Reason = Truncate(Guard.AgainstNullOrWhiteSpace(reason, nameof(reason)).Trim(), ReasonMaxLength),
            ChargeAmount = Guard.AgainstNegative(chargeAmount, nameof(chargeAmount)),
            PreviousDeliveredAtUtc = previousDeliveredAtUtc,
        };
    }

    /// <summary>
    /// Trimmed to fit rather than refused. The reason is somebody at a counter repeating a
    /// complaint, and losing the alteration because they were thorough would be the wrong trade.
    /// </summary>
    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];

    public void SetCreationAudit(Guid createdBy, DateTime createdAtUtc)
    {
        CreatedBy = Guard.AgainstEmpty(createdBy, nameof(createdBy));
        CreatedAtUtc = createdAtUtc;
    }

    public void SetModificationAudit(Guid modifiedBy, DateTime modifiedAtUtc)
    {
        LastModifiedBy = Guard.AgainstEmpty(modifiedBy, nameof(modifiedBy));
        LastModifiedAtUtc = modifiedAtUtc;
    }
}
