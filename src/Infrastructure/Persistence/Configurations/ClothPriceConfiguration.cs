using MathilensERP.Domain.Pricing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "ClothPrices" entity — the shop's price list, keyed by fabric roll/style reference.</summary>
public class ClothPriceConfiguration : IEntityTypeConfiguration<ClothPrice>
{
    public void Configure(EntityTypeBuilder<ClothPrice> builder)
    {
        builder.ToTable("ClothPrices");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.ClothCode)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(c => c.ClothName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(c => c.CostPrice)
            .IsRequired()
            .HasColumnType("numeric(12,2)");

        builder.Property(c => c.SellingPrice)
            .IsRequired()
            .HasColumnType("numeric(12,2)");

        builder.Property(c => c.CreatedBy).IsRequired();
        builder.Property(c => c.CreatedAtUtc).IsRequired();

        // Active-code lookups filter on IsDeleted, and staff need to find a code fast when
        // typing it into the New Order picker — both want an index, not a table scan.
        builder.HasIndex(c => c.IsDeleted);
        builder.HasIndex(c => c.ClothCode);

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
