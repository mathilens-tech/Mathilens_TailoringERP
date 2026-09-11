namespace MathilensERP.Shared.Constants;

/// <summary>
/// Well-known actor identifiers for audit stamping (02_DATABASE.md § 6) when there is no
/// authenticated caller — e.g. baseline role/data seeding at deployment time.
/// Deliberately not <see cref="Guid.Empty"/>: audit fields are guarded against an empty
/// GUID, since "no actor recorded" is exactly the failure this constant exists to prevent.
/// </summary>
public static class SystemUsers
{
    public static readonly Guid SystemUserId = new("00000000-0000-0000-0000-000000000001");
}
