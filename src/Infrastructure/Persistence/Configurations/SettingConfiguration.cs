using MathilensERP.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "Settings" entity (02_DATABASE.md § 10.12).</summary>
public class SettingConfiguration : IEntityTypeConfiguration<Setting>
{
    public void Configure(EntityTypeBuilder<Setting> builder)
    {
        builder.ToTable("Settings");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Key)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(s => s.Value)
            .IsRequired()
            .HasMaxLength(4000);

        builder.Property(s => s.CreatedBy).IsRequired();
        builder.Property(s => s.CreatedAtUtc).IsRequired();

        // 02_DATABASE.md § 10.12 Index Recommendations.
        builder.HasIndex(s => s.Key).IsUnique();

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
