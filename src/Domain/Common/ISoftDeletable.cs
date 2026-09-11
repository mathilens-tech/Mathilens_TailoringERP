namespace MathilensERP.Domain.Common;

/// <summary>
/// Contract for the soft-delete flag (02_DATABASE.md § 5), implemented both by
/// <see cref="AuditableEntity"/> and by Infrastructure-layer types that cannot inherit it.
/// A single EF Core global query filter can target every <see cref="ISoftDeletable"/> type
/// so no repository has to remember to filter deleted rows manually.
/// </summary>
public interface ISoftDeletable
{
    bool IsDeleted { get; }

    DateTime? DeletedAtUtc { get; }

    Guid? DeletedBy { get; }

    void SoftDelete(Guid deletedBy, DateTime deletedAtUtc);
}
