using MathilensERP.Domain.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "FabricDetails" entity (02_DATABASE.md § 10.11).</summary>
public class FabricDetailsConfiguration : IEntityTypeConfiguration<FabricDetails>
{
    public void Configure(EntityTypeBuilder<FabricDetails> builder)
    {
        builder.ToTable("FabricDetails");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.OrderItemId).IsRequired();

        builder.Property(f => f.FabricType)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(f => f.Source)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(f => f.Color)
            .HasMaxLength(50);

        builder.Property(f => f.Quantity)
            .IsRequired()
            .HasPrecision(10, 2);

        // Nullable: the cloth code field accepts any text, so fabric that matched no catalogue
        // entry still records what was typed — it simply never reaches stock.
        builder.Property(f => f.ClothPriceId);
        builder.Property(f => f.ClothCode).HasMaxLength(50);

        builder.Property(f => f.Unit)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20);

        // Stock subtracts consumption per cloth, so that lookup is indexed. Filtered to the rows
        // that can ever contribute — unmatched cloth codes are the common case for older orders.
        builder.HasIndex(f => f.ClothPriceId)
            .HasFilter("\"ClothPriceId\" IS NOT NULL");

        builder.Property(f => f.CreatedBy).IsRequired();
        builder.Property(f => f.CreatedAtUtc).IsRequired();

        // The one-to-one relationship to OrderItem (configured on OrderItemConfiguration's
        // `Fabric` navigation) already gives this FK a unique index by convention.

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
