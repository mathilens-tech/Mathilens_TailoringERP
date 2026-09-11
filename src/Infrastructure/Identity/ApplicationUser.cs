using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;
using Microsoft.AspNetCore.Identity;

namespace MathilensERP.Infrastructure.Identity;

/// <summary>
/// ASP.NET Core Identity's user, extended with the standard audit footprint and soft
/// delete. Realizes the "Users" entity documented in 02_DATABASE.md § 10.1.
///
/// Lives in Infrastructure, not Domain: IdentityUser is an ASP.NET Core Identity type,
/// and Domain must have zero framework dependencies (01_ARCHITECTURE.md § 9.3 /
/// Architecture Constraints § 4). It implements the same <see cref="IAuditable"/>/
/// <see cref="ISoftDeletable"/> contracts as <see cref="AuditableEntity"/> so a single
/// SaveChanges interceptor can stamp both Domain entities and Identity types uniformly.
/// </summary>
public class ApplicationUser : IdentityUser<Guid>, IAuditable, ISoftDeletable
{
    /// <summary>
    /// What to call this person — "Kavitha R" rather than the address they sign in with.
    ///
    /// Nullable, because every account that existed before this column did has no name recorded and
    /// nobody can invent one for them. Screens fall back to the email, which is what they showed
    /// before, so an unnamed account reads exactly as it always did.
    ///
    /// Not <see cref="IdentityUser{TKey}.UserName"/>: that holds the username the person signs in
    /// with and is what Identity looks an account up by, so putting a display name in it would
    /// change who could sign in as whom. The mobile number likewise reuses Identity's own
    /// <see cref="IdentityUser{TKey}.PhoneNumber"/> rather than adding a column beside it.
    /// </summary>
    public string? FullName { get; set; }

    public DateTime CreatedAtUtc { get; private set; }

    public Guid CreatedBy { get; private set; }

    public DateTime? LastModifiedAtUtc { get; private set; }

    public Guid? LastModifiedBy { get; private set; }

    public bool IsDeleted { get; private set; }

    public DateTime? DeletedAtUtc { get; private set; }

    public Guid? DeletedBy { get; private set; }

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
}
