using MathilensERP.Domain.Billing;
using MathilensERP.Domain.Customers;
using MathilensERP.Domain.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "Invoices" entity (02_DATABASE.md § 10.9) — the aggregate root for its <see cref="Payment"/>s.</summary>
public class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.ToTable("Invoices");
        builder.HasKey(i => i.Id);

        builder.Property(i => i.InvoiceNumber).IsRequired().HasMaxLength(32);

        // Filtered, so the blank left on an invoice raised before numbering existed cannot block
        // the next one. An unfiltered index here allowed exactly one such row and rejected everything
        // after it — that is what took ordering down on the live site, and it is not worth repeating.
        builder.HasIndex(i => i.InvoiceNumber)
            .IsUnique()
            .HasFilter("\"InvoiceNumber\" <> ''");

        builder.Property(i => i.OrderId).IsRequired();
        builder.Property(i => i.CustomerId).IsRequired();

        builder.Property(i => i.Subtotal).IsRequired().HasPrecision(10, 2);
        builder.Property(i => i.TaxAmount).IsRequired().HasPrecision(10, 2);
        builder.Property(i => i.DiscountAmount).IsRequired().HasPrecision(10, 2);
        builder.Property(i => i.TotalAmount).IsRequired().HasPrecision(10, 2);
        builder.Property(i => i.AmountPaid).IsRequired().HasPrecision(10, 2);

        builder.Property(i => i.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Ignore(i => i.RemainingBalance);
        builder.Ignore(i => i.CanVoid);

        builder.HasOne<Order>()
            .WithMany()
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Customer>()
            .WithMany()
            .HasForeignKey(i => i.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(i => i.Payments)
            .WithOne()
            .HasForeignKey(p => p.InvoiceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Navigation(i => i.Payments).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.Property(i => i.CreatedBy).IsRequired();
        builder.Property(i => i.CreatedAtUtc).IsRequired();

        // 02_DATABASE.md § 10.9 Index Recommendations.
        builder.HasIndex(i => i.OrderId);
        builder.HasIndex(i => i.CustomerId);
        builder.HasIndex(i => new { i.Status, i.CreatedAtUtc });

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
