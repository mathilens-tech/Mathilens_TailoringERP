using MathilensERP.Domain.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "OrderItems" entity (02_DATABASE.md § 10.8).</summary>
public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("OrderItems");
        builder.HasKey(i => i.Id);

        builder.Property(i => i.OrderId).IsRequired();

        builder.Property(i => i.GarmentType)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(i => i.Quantity).IsRequired();

        builder.Property(i => i.UnitPrice)
            .IsRequired()
            .HasPrecision(10, 2);

        builder.HasOne(i => i.Fabric)
            .WithOne()
            .HasForeignKey<FabricDetails>(f => f.OrderItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(i => i.CreatedBy).IsRequired();
        builder.Property(i => i.CreatedAtUtc).IsRequired();

        // 02_DATABASE.md § 10.8 Index Recommendations.
        builder.HasIndex(i => i.OrderId);

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
