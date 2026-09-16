using MathilensERP.Domain.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "OrderDrafts" table — an order somebody started and has not finished.</summary>
public class OrderDraftConfiguration : IEntityTypeConfiguration<OrderDraft>
{
    public void Configure(EntityTypeBuilder<OrderDraft> builder)
    {
        builder.ToTable("OrderDrafts");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.OwnerUserId).IsRequired();

        builder.Property(d => d.Kind)
            .IsRequired()
            .HasMaxLength(40);

        builder.Property(d => d.Summary)
            .IsRequired()
            .HasMaxLength(300);

        // jsonb, like Measurements.Values: the column holds the New Order form's own state, and a
        // person inspecting the table should see the order they were writing rather than an opaque
        // string. No length cap — an order with thirty garments on it is a long payload and there is
        // no honest number at which a draft should start failing to save.
        builder.Property(d => d.Payload)
            .IsRequired()
            .HasColumnType("jsonb");

        // No foreign key to Customers on purpose — see OrderDraft.CustomerId. A draft must never be
        // the reason a customer cannot be removed.
        builder.Property(d => d.CustomerId);

        builder.Property(d => d.CreatedBy).IsRequired();
        builder.Property(d => d.CreatedAtUtc).IsRequired();

        // The list query is always "this person's drafts, newest first", so the index carries the
        // sort as well as the filter and the read never touches the table out of order.
        builder.HasIndex(d => new { d.OwnerUserId, d.LastModifiedAtUtc });

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
