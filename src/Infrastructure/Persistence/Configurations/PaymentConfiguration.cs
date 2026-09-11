using MathilensERP.Domain.Billing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "Payments" entity (02_DATABASE.md § 10.10).</summary>
public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("Payments");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.InvoiceId).IsRequired();

        builder.Property(p => p.Amount)
            .IsRequired()
            .HasPrecision(10, 2);

        builder.Property(p => p.Method)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(p => p.CreatedBy).IsRequired();
        builder.Property(p => p.CreatedAtUtc).IsRequired();

        // 02_DATABASE.md § 10.10 Index Recommendations.
        builder.HasIndex(p => p.InvoiceId);
        builder.HasIndex(p => p.CreatedAtUtc);
    }
}
