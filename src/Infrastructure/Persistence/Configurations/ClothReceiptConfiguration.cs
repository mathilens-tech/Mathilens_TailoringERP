using MathilensERP.Domain.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "ClothReceipts" entity — the inventory log of cloth arriving at the shop.</summary>
public class ClothReceiptConfiguration : IEntityTypeConfiguration<ClothReceipt>
{
    public void Configure(EntityTypeBuilder<ClothReceipt> builder)
    {
        builder.ToTable("ClothReceipts");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.ClothPriceId).IsRequired();

        builder.Property(r => r.ClothCode)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(r => r.ClothName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(r => r.Quantity)
            .IsRequired()
            .HasColumnType("numeric(12,2)");

        // Stored as its name, matching how every other enum in this schema is persisted.
        builder.Property(r => r.Unit)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(r => r.ReceivedOn).IsRequired();

        builder.Property(r => r.SupplierName).HasMaxLength(200);
        builder.Property(r => r.InvoiceNumber).HasMaxLength(50);
        builder.Property(r => r.RatePerUnit).HasColumnType("numeric(12,2)");
        builder.Property(r => r.Notes).HasMaxLength(1000);

        builder.Property(r => r.CreatedBy).IsRequired();
        builder.Property(r => r.CreatedAtUtc).IsRequired();

        // No navigation to ClothPrice: the code and name are copied onto the receipt, so reading
        // the log never needs the catalogue — and a re-priced or removed entry must not change
        // what a past delivery says arrived. The id is kept for tracing back to the catalogue.

        // The log is read newest-first and filtered by cloth or by date.
        builder.HasIndex(r => r.ReceivedOn);
        builder.HasIndex(r => r.ClothPriceId);
        builder.HasIndex(r => r.IsDeleted);

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
