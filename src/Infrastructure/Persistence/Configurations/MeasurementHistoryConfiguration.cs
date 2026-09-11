using MathilensERP.Domain.Measurements;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "MeasurementHistory" entity (02_DATABASE.md § 10.5).</summary>
public class MeasurementHistoryConfiguration : IEntityTypeConfiguration<MeasurementHistory>
{
    public void Configure(EntityTypeBuilder<MeasurementHistory> builder)
    {
        builder.ToTable("MeasurementHistory");
        builder.HasKey(h => h.Id);

        builder.Property(h => h.MeasurementId).IsRequired();

        builder.Property(h => h.GarmentType)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(h => h.ValuesJson)
            .IsRequired()
            .HasColumnName("Values");

        builder.Ignore(h => h.Values);

        builder.Property(h => h.CreatedBy).IsRequired();
        builder.Property(h => h.CreatedAtUtc).IsRequired();

        // 02_DATABASE.md § 10.5 Index Recommendations.
        builder.HasIndex(h => h.MeasurementId);
        builder.HasIndex(h => h.CreatedAtUtc);
    }
}
