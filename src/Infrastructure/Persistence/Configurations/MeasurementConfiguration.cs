using MathilensERP.Domain.Measurements;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "Measurements" entity (02_DATABASE.md § 10.4).</summary>
public class MeasurementConfiguration : IEntityTypeConfiguration<Measurement>
{
    public void Configure(EntityTypeBuilder<Measurement> builder)
    {
        builder.ToTable("Measurements");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.CustomerId).IsRequired();

        builder.Property(m => m.GarmentType)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(m => m.ValuesJson)
            .IsRequired()
            .HasColumnName("Values");

        builder.Ignore(m => m.Values);

        // Nullable, and generous: a fitting note is a sentence or two, but it is the tailor's own
        // words and a cap they can hit while writing one is a cap in the wrong place.
        builder.Property(m => m.Notes)
            .HasMaxLength(1000);

        builder.Property(m => m.CreatedBy).IsRequired();
        builder.Property(m => m.CreatedAtUtc).IsRequired();

        // 02_DATABASE.md § 10.4 Index Recommendations.
        builder.HasIndex(m => m.CustomerId);
        builder.HasIndex(m => new { m.CustomerId, m.GarmentType });

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
