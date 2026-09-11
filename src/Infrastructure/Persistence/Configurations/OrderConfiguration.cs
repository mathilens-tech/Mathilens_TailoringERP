using MathilensERP.Domain.Customers;
using MathilensERP.Domain.Employees;
using MathilensERP.Domain.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "Orders" entity (02_DATABASE.md § 10.7) — the aggregate root for its <see cref="OrderItem"/>s.</summary>
public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders");
        builder.HasKey(o => o.Id);

        builder.Property(o => o.OrderNumber)
            .IsRequired()
            .HasMaxLength(30);

        builder.Property(o => o.CustomerId).IsRequired();

        builder.Property(o => o.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(o => o.DueAtUtc).IsRequired();

        // Null until the order is delivered.
        builder.Property(o => o.DeliveredAtUtc);
        builder.Property(o => o.WorkStartedAtUtc);
        builder.Property(o => o.WorkCompletedAtUtc);

        builder.Property(o => o.Notes).HasMaxLength(2000);

        builder.HasOne<Customer>()
            .WithMany()
            .HasForeignKey(o => o.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Employee>()
            .WithMany()
            .HasForeignKey(o => o.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(o => o.Items).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.Property(o => o.CreatedBy).IsRequired();
        builder.Property(o => o.CreatedAtUtc).IsRequired();

        // Unfiltered, unlike the soft-delete-aware unique indexes elsewhere: a cancelled or deleted
        // order keeps its number forever. Handing a reference back out would point two garments,
        // two receipts and two conversations at the same string.
        builder.HasIndex(o => o.OrderNumber).IsUnique();

        // 02_DATABASE.md § 10.7 Index Recommendations.
        builder.HasIndex(o => o.CustomerId);
        builder.HasIndex(o => o.EmployeeId);
        builder.HasIndex(o => new { o.Status, o.DueAtUtc });

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
