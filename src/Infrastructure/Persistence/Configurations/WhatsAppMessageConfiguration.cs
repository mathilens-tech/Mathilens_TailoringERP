using MathilensERP.Domain.Customers;
using MathilensERP.Domain.Orders;
using MathilensERP.Domain.WhatsApp;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "WhatsAppMessages" log (00_MASTER_SPEC.md § 3 WhatsApp module).</summary>
public class WhatsAppMessageConfiguration : IEntityTypeConfiguration<WhatsAppMessage>
{
    public void Configure(EntityTypeBuilder<WhatsAppMessage> builder)
    {
        builder.ToTable("WhatsAppMessages");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.CustomerId).IsRequired();

        builder.Property(m => m.MessageType)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(m => m.Content)
            .IsRequired()
            .HasMaxLength(4096);

        builder.Property(m => m.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(m => m.ProviderMessageId)
            .HasMaxLength(200);

        builder.Property(m => m.FailureReason)
            .HasMaxLength(1000);

        builder.Property(m => m.CreatedBy).IsRequired();
        builder.Property(m => m.CreatedAtUtc).IsRequired();

        builder.HasOne<Customer>()
            .WithMany()
            .HasForeignKey(m => m.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Order>()
            .WithMany()
            .HasForeignKey(m => m.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(m => m.CustomerId);
        builder.HasIndex(m => m.OrderId);
        builder.HasIndex(m => new { m.Status, m.CreatedAtUtc });

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
