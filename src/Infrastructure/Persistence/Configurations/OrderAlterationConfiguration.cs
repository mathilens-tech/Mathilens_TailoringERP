using MathilensERP.Domain.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "OrderAlterations" entity — one row per time an order came back.</summary>
public class OrderAlterationConfiguration : IEntityTypeConfiguration<OrderAlteration>
{
    public void Configure(EntityTypeBuilder<OrderAlteration> builder)
    {
        builder.ToTable("OrderAlterations");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.OrderId).IsRequired();

        builder.Property(a => a.Reason)
            .IsRequired()
            .HasMaxLength(OrderAlteration.ReasonMaxLength);

        builder.Property(a => a.ChargeAmount)
            .IsRequired()
            .HasPrecision(10, 2)
            .HasDefaultValue(0m);

        builder.Property(a => a.PreviousDeliveredAtUtc);

        builder.Property(a => a.CreatedBy).IsRequired();
        builder.Property(a => a.CreatedAtUtc).IsRequired();

        // The only read there is: this order's alterations, oldest first, on the order screen.
        builder.HasIndex(a => new { a.OrderId, a.CreatedAtUtc });

        // No row version. These rows are written once and never updated — an alteration is an event
        // that happened — so there is no concurrent edit for xmin to catch.
    }
}
