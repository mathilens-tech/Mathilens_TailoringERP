using MathilensERP.Domain.Common;
using MathilensERP.Shared.Guards;

namespace MathilensERP.Domain.Settings;

/// <summary>
/// A single shop-level configuration value (02_DATABASE.md § 10.12) — business profile,
/// preferences, integration configuration. Keyed by <see cref="Key"/>, not looked up by other
/// entities via a foreign key: "referenced by nearly every module for configuration values
/// rather than holding foreign keys itself."
///
/// Not <see cref="AuditableEntity"/>/<see cref="ISoftDeletable"/>: 02_DATABASE.md § 10.12
/// Retention Rules explicitly exempts Settings from the standard soft-delete pattern —
/// configuration is either present with a current value, or genuinely removed by an
/// explicit administrative action, never "soft" in between.
/// </summary>
public sealed class Setting : IAuditable
{
    public Guid Id { get; private set; }

    public string Key { get; private set; } = string.Empty;

    public string Value { get; private set; } = string.Empty;

    public DateTime CreatedAtUtc { get; private set; }

    public Guid CreatedBy { get; private set; }

    public DateTime? LastModifiedAtUtc { get; private set; }

    public Guid? LastModifiedBy { get; private set; }

    private Setting()
    {
        // Reserved for EF Core materialization.
    }

    public static Setting Create(string key, string value)
    {
        return new Setting
        {
            Id = Guid.NewGuid(),
            Key = Guard.AgainstNullOrWhiteSpace(key, nameof(key)),
            Value = value,
        };
    }

    public void UpdateValue(string value) => Value = value;

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
