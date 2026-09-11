using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Common;

/// <summary>
/// Base for every entity that represents a business record. Carries the standard
/// audit footprint and soft-delete flag documented in 02_DATABASE.md §§ 5-6.
///
/// Optimistic concurrency (02_DATABASE.md § 7) is intentionally not represented here:
/// it is configured against PostgreSQL's native <c>xmin</c> system column entirely in
/// Infrastructure's EF Core entity configuration, so Domain stays free of any
/// persistence-technology detail (01_ARCHITECTURE.md § 9.3).
/// </summary>
public abstract class AuditableEntity : IAuditable, ISoftDeletable
{
    public Guid Id { get; protected set; }

    public DateTime CreatedAtUtc { get; private set; }

    public Guid CreatedBy { get; private set; }

    public DateTime? LastModifiedAtUtc { get; private set; }

    public Guid? LastModifiedBy { get; private set; }

    public bool IsDeleted { get; private set; }

    public DateTime? DeletedAtUtc { get; private set; }

    public Guid? DeletedBy { get; private set; }

    protected AuditableEntity()
    {
    }

    protected AuditableEntity(Guid id)
    {
        Id = Guard.AgainstEmpty(id, nameof(id));
    }

    /// <summary>
    /// Stamped once, by the persistence layer (an EF Core <c>SaveChanges</c> interceptor
    /// in Infrastructure), the first time the entity is saved.
    /// </summary>
    public void SetCreationAudit(Guid createdBy, DateTime createdAtUtc)
    {
        CreatedBy = Guard.AgainstEmpty(createdBy, nameof(createdBy));
        CreatedAtUtc = createdAtUtc;
    }

    /// <summary>
    /// Stamped by the persistence layer on every subsequent update.
    /// </summary>
    public void SetModificationAudit(Guid modifiedBy, DateTime modifiedAtUtc)
    {
        LastModifiedBy = Guard.AgainstEmpty(modifiedBy, nameof(modifiedBy));
        LastModifiedAtUtc = modifiedAtUtc;
    }

    /// <summary>
    /// Soft-deletes the entity (02_DATABASE.md § 5). Physical deletion is a distinct,
    /// explicitly named, audited operation and is never performed through this method.
    /// </summary>
    public void SoftDelete(Guid deletedBy, DateTime deletedAtUtc)
    {
        if (IsDeleted)
        {
            return;
        }

        IsDeleted = true;
        DeletedBy = Guard.AgainstEmpty(deletedBy, nameof(deletedBy));
        DeletedAtUtc = deletedAtUtc;
    }

    /// <summary>Reverses a soft delete.</summary>
    public void Restore()
    {
        IsDeleted = false;
        DeletedBy = null;
        DeletedAtUtc = null;
    }
}
