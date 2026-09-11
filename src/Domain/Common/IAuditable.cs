namespace MathilensERP.Domain.Common;

/// <summary>
/// Contract for the standard audit footprint (02_DATABASE.md § 6), implemented both by
/// <see cref="AuditableEntity"/> and by Infrastructure-layer types that cannot inherit it
/// (e.g. ApplicationUser, which must inherit ASP.NET Core Identity's IdentityUser). Letting
/// a single SaveChanges interceptor stamp audit fields on any <see cref="IAuditable"/>
/// regardless of its base class (00_MASTER_SPEC.md § 16.2 — shared concerns implemented once).
/// </summary>
public interface IAuditable
{
    DateTime CreatedAtUtc { get; }

    Guid CreatedBy { get; }

    DateTime? LastModifiedAtUtc { get; }

    Guid? LastModifiedBy { get; }

    void SetCreationAudit(Guid createdBy, DateTime createdAtUtc);

    void SetModificationAudit(Guid modifiedBy, DateTime modifiedAtUtc);
}
