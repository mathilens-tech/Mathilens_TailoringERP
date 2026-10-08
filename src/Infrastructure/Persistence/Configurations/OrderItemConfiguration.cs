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

        // One-to-many: a garment can be cut from several cloths. Was one-to-one (one Fabric per item)
        // until a 16-shirt order from 5 bolts could not be recorded. The collection is exposed
        // read-only over a backing field, so EF is told to go through the field rather than the
        // property's (absent) setter.
        builder.HasMany(i => i.Fabrics)
            .WithOne()
            .HasForeignKey(f => f.OrderItemId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(OrderItem.Fabrics))!.SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.Property(i => i.CreatedBy).IsRequired();
        builder.Property(i => i.CreatedAtUtc).IsRequired();

        // 02_DATABASE.md § 10.8 Index Recommendations.
        builder.HasIndex(i => i.OrderId);

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
