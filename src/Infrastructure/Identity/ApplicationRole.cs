using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;
using Microsoft.AspNetCore.Identity;

namespace MathilensERP.Infrastructure.Identity;

/// <summary>
/// ASP.NET Core Identity's role, extended with the standard audit footprint.
/// Realizes the "Roles" entity documented in 02_DATABASE.md § 10.2.
///
/// Not soft-deletable: per 02_DATABASE.md § 10.2 Retention Rules, roles are reference
/// data — removal requires reassigning affected users first, rather than following the
/// standard soft-delete lifecycle of a business record.
/// </summary>
public class ApplicationRole : IdentityRole<Guid>, IAuditable
{
    public DateTime CreatedAtUtc { get; private set; }

    public Guid CreatedBy { get; private set; }

    public DateTime? LastModifiedAtUtc { get; private set; }

    public Guid? LastModifiedBy { get; private set; }

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
