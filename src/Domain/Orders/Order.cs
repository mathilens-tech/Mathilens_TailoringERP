using MathilensERP.Domain.Common;
using MathilensERP.Domain.Inventory;
using MathilensERP.Domain.Measurements;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Orders;

/// <summary>
/// A tailoring order placed by a customer (02_DATABASE.md § 10.7) — the central operational
/// record of the business, and the aggregate root for its <see cref="OrderItem"/>s and their
/// <see cref="FabricDetails"/>.
/// </summary>
public sealed class Order : AuditableEntity
{
    /// <summary>Received → InProgress → ReadyForDelivery → Delivered; any non-terminal state → Cancelled.</summary>
    private static readonly Dictionary<OrderStatus, OrderStatus[]> AllowedTransitions = new()
    {
        [OrderStatus.Received] = [OrderStatus.InProgress, OrderStatus.Cancelled],
        [OrderStatus.InProgress] = [OrderStatus.ReadyForDelivery, OrderStatus.Cancelled],
        [OrderStatus.ReadyForDelivery] = [OrderStatus.Delivered, OrderStatus.Cancelled],
        [OrderStatus.Delivered] = [],
        [OrderStatus.Cancelled] = [],
        // Terminal on arrival: the cloth is already across the counter, so there is no later step to
        // record. Present with an empty list rather than absent, because CanTransitionTo indexes
        // this map directly and a missing key would throw instead of answering "no".
        [OrderStatus.Sold] = [],
    };

    private readonly List<OrderItem> _items = [];

    /// <summary>
    /// What the shop and the customer call this order out loud — "MTL-0001". The prefix is the
    /// shop's, the count runs continuously and is never reused.
    ///
    /// <para>
    /// Stored whole rather than rebuilt from a prefix and a count at display time. The prefix is a
    /// setting somebody can change, and rebuilding would then quietly renumber every order already
    /// written on a receipt in the customer's hand.
    /// </para>
    /// </summary>
    public string OrderNumber { get; private set; } = string.Empty;

    public Guid CustomerId { get; private set; }

    public Guid? EmployeeId { get; private set; }

    public OrderStatus Status { get; private set; }

    public DateTime DueAtUtc { get; private set; }

    /// <summary>When the garment actually changed hands. Null until the order reaches <see cref="OrderStatus.Delivered"/>.</summary>
    public DateTime? DeliveredAtUtc { get; private set; }

    /// <summary>
    /// When the order moved to <see cref="OrderStatus.InProgress"/> — the point the assigned
    /// tailor picked the work up. Null until it does. Stamped here rather than reconstructed from
    /// the activity trail, which records who acted but is not a place to query workloads from.
    /// </summary>
    public DateTime? WorkStartedAtUtc { get; private set; }

    /// <summary>
    /// When the order moved to <see cref="OrderStatus.ReadyForDelivery"/> — the point the work
    /// itself was finished, which is distinct from <see cref="DeliveredAtUtc"/>: a garment can sit
    /// finished on the rack for days before the customer collects it.
    /// </summary>
    public DateTime? WorkCompletedAtUtc { get; private set; }

    public string? Notes { get; private set; }

    /// <summary>
    /// The order's live line items. Removed items are soft-deleted rather than dropped
    /// (02_DATABASE.md § 5), and stay in the backing field until the aggregate is reloaded —
    /// at which point EF's global soft-delete filter excludes them — so this view filters
    /// them out to keep the in-memory aggregate consistent with a freshly loaded one.
    /// </summary>
    public IReadOnlyList<OrderItem> Items => _items.Where(i => !i.IsDeleted).ToList();

    /// <summary>An order's details, items and fabric can only be changed while it's still open — not once delivered or cancelled.</summary>
    // Sold belongs here with the other two finished states: a fabric sale is complete the moment it
    // is recorded, so its items must be as fixed as a delivered order's. Left out, every sale would
    // read as open work and stay editable forever.
    public bool IsOpen => Status is not (OrderStatus.Delivered or OrderStatus.Cancelled or OrderStatus.Sold);

    /// <summary>
    /// Work cannot start on an unassigned order: <see cref="OrderStatus.InProgress"/> means a named
    /// tailor picked it up, and <see cref="WorkStartedAtUtc"/> is stamped against them. Starting
    /// without an assignment would record a start time nobody owns.
    /// </summary>
    public bool RequiresEmployeeToStartWork => EmployeeId is null;

    /// <summary>
    /// What this order's live items are worth — quantity × unit price. This is the order's own
    /// value, so it carries no invoice tax or discount: those belong to the bill, not the work.
    /// Computed in memory over a loaded aggregate; not usable inside a database query.
    /// </summary>
    public decimal TotalAmount => Items.Sum(i => i.Quantity * i.UnitPrice);

    private Order()
    {
        // Reserved for EF Core materialization.
    }

    private Order(Guid id)
        : base(id)
    {
    }

    /// <summary>
    /// <paramref name="orderNumber"/> is optional so that the domain tests, which care about the
    /// lifecycle rather than the label, are not each obliged to invent one. Every order the
    /// application creates is given a number by <c>IOrderNumberGenerator</c>; an order without one
    /// is a fixture, not something the shop can have made.
    /// </summary>
    public static Order Create(
        Guid customerId,
        DateTime dueAtUtc,
        Guid? employeeId,
        string? notes = null,
        string? orderNumber = null)
    {
        return new Order(Guid.NewGuid())
        {
            CustomerId = Guard.AgainstEmpty(customerId, nameof(customerId)),
            EmployeeId = employeeId,
            DueAtUtc = dueAtUtc,
            Notes = notes,
            Status = OrderStatus.Received,
            OrderNumber = orderNumber?.Trim() ?? string.Empty,
        };
    }

    /// <summary>
    /// Records cloth sold over the counter, with nothing to stitch.
    ///
    /// <para>A separate factory rather than a status argument on <see cref="Create"/>: this is the
    /// only way an order may begin anywhere other than <see cref="OrderStatus.Received"/>, and a
    /// caller that could pass any status could start one at Delivered.</para>
    ///
    /// <para><c>DueAtUtc</c> is the moment of sale, because a length of cloth is collected as it is
    /// bought — there is no date to promise. It opens <see cref="OrderStatus.Received"/> like any
    /// other order so that its lines can be added, and is closed by <see cref="SealAsSale"/> once
    /// they have been; a sale that began life already Sold could never have been given anything to
    /// sell, since <c>AddItem</c> refuses a finished order.</para>
    ///
    /// <para>No employee: nobody is assigned work that does not exist.</para>
    /// </summary>
    public static Order CreateFabricSale(
        Guid customerId,
        DateTime soldAtUtc,
        string? notes = null,
        string? orderNumber = null)
    {
        return new Order(Guid.NewGuid())
        {
            CustomerId = Guard.AgainstEmpty(customerId, nameof(customerId)),
            EmployeeId = null,
            DueAtUtc = soldAtUtc,
            Notes = notes,
            Status = OrderStatus.Received,
            OrderNumber = orderNumber?.Trim() ?? string.Empty,
        };
    }

    /// <summary>
    /// Closes a counter sale once its cloth lines are on it — the second half of
    /// <see cref="CreateFabricSale"/>, never called on anything else.
    ///
    /// <para>Refused unless the order is still untouched at <see cref="OrderStatus.Received"/> with
    /// no tailor on it, which is the state <see cref="CreateFabricSale"/> leaves and a real garment
    /// order leaves the moment anyone works it. That is what stops this being a back door for
    /// marking a stitching job Sold and skipping its lifecycle.</para>
    ///
    /// <para><c>DeliveredAtUtc</c> is set to the same moment: the cloth went across the counter as
    /// it was paid for. It is filled rather than left null because the revenue and collection
    /// reports read that column and know nothing about sales.</para>
    /// </summary>
    public void SealAsSale(DateTime soldAtUtc)
    {
        if (Status != OrderStatus.Received || EmployeeId is not null)
        {
            throw new InvalidOperationException("Only a newly created counter sale can be sealed as sold.");
        }

        Status = OrderStatus.Sold;
        DeliveredAtUtc = soldAtUtc;
        WorkCompletedAtUtc ??= soldAtUtc;
    }

    /// <summary>
    /// Corrects the order's header details — who it is for, who is working it, when it is due,
    /// and its notes. Guarded by <see cref="IsOpen"/> for the same reason the item
    /// methods are: a delivered or cancelled order is a closed record, not a draft.
    /// </summary>
    public void UpdateDetails(Guid customerId, Guid? employeeId, DateTime dueAtUtc, string? notes)
    {
        EnsureModifiable("update");

        CustomerId = Guard.AgainstEmpty(customerId, nameof(customerId));
        EmployeeId = employeeId;
        DueAtUtc = dueAtUtc;
        Notes = notes;
    }

    /// <summary>Adds a garment line item. Callers should check <see cref="IsOpen"/> first — see 01_ARCHITECTURE.md § 11 Validation Strategy.</summary>
    public OrderItem AddItem(string garmentType, int quantity, decimal unitPrice)
    {
        EnsureModifiable("add items to");

        var item = OrderItem.Create(Id, garmentType, quantity, unitPrice);
        _items.Add(item);
        return item;
    }

    /// <summary>Corrects one of this order's garment line items. Its fabric details are left untouched.</summary>
    public void UpdateItem(Guid orderItemId, string garmentType, int quantity, decimal unitPrice)
    {
        EnsureModifiable("update items on");

        RequireItem(orderItemId).UpdateDetails(garmentType, quantity, unitPrice);
    }

    /// <summary>
    /// Soft-deletes a garment line item. An order must keep at least one live item — an order
    /// that bills for nothing should be cancelled, not emptied.
    /// </summary>
    public void RemoveItem(Guid orderItemId, Guid removedBy, DateTime removedAtUtc)
    {
        EnsureModifiable("remove items from");

        var item = RequireItem(orderItemId);

        if (Items.Count == 1)
        {
            throw new InvalidOperationException("Cannot remove the last item from an order — cancel the order instead.");
        }

        item.SoftDelete(removedBy, removedAtUtc);
    }

    /// <summary>Sets (or replaces) the fabric details for one of this order's items.</summary>
    public void SetItemFabric(
        Guid orderItemId,
        string fabricType,
        FabricSource source,
        string? color,
        decimal quantity,
        Guid? clothPriceId = null,
        string? clothCode = null,
        ClothUnit unit = ClothUnit.Metres)
    {
        EnsureModifiable("set fabric on");

        RequireItem(orderItemId).SetFabric(fabricType, source, color, quantity, clothPriceId, clothCode, unit);
    }

    public void AssignEmployee(Guid employeeId) => EmployeeId = Guard.AgainstEmpty(employeeId, nameof(employeeId));

    /// <summary>Whether this order can move to <paramref name="target"/> from its current status. Callers should check this before calling <see cref="TransitionTo"/>.</summary>
    public bool CanTransitionTo(OrderStatus target) => AllowedTransitions[Status].Contains(target);

    /// <summary>
    /// Moves the order to <paramref name="target"/>. Delivering also records when the garment was
    /// handed over — supplied by the caller rather than read off the clock, so a handover entered
    /// late is still dated the day it happened.
    /// </summary>
    public void TransitionTo(OrderStatus target, DateTime? deliveredAtUtc = null, DateTime? occurredAtUtc = null)
    {
        if (!CanTransitionTo(target))
        {
            throw new InvalidOperationException($"Cannot transition an order from '{Status}' to '{target}'.");
        }

        // Deliberately not folded into CanTransitionTo: that answers whether the lifecycle allows
        // the move, and callers use it to offer the next steps. An unassigned order's next step is
        // still "start work" — it just needs a tailor named first, which is a different message.
        if (target == OrderStatus.InProgress && RequiresEmployeeToStartWork)
        {
            throw new InvalidOperationException("Cannot start work on an order with no employee assigned.");
        }

        if (target == OrderStatus.Delivered)
        {
            DeliveredAtUtc = deliveredAtUtc
                ?? throw new ArgumentNullException(nameof(deliveredAtUtc), "Delivering an order requires the date it was handed over.");
        }

        // Stamped only on the first arrival at each state. The progression is forward-only, so in
        // practice that is every arrival — but leaving the first one standing is the behaviour that
        // stays correct if a backward transition is ever allowed.
        if (target == OrderStatus.InProgress)
        {
            WorkStartedAtUtc ??= occurredAtUtc;
        }
        else if (target == OrderStatus.ReadyForDelivery)
        {
            WorkCompletedAtUtc ??= occurredAtUtc;
        }

        Status = target;
    }

    private OrderItem RequireItem(Guid orderItemId) =>
        _items.SingleOrDefault(i => i.Id == orderItemId && !i.IsDeleted)
            ?? throw new InvalidOperationException($"Order item '{orderItemId}' does not belong to this order.");

    private void EnsureModifiable(string action)
    {
        if (!IsOpen)
        {
            throw new InvalidOperationException($"Cannot {action} an order that is '{Status}'.");
        }
    }
}
