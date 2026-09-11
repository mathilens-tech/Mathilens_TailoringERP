using MathilensERP.Domain.Customers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes "OccasionContacts" — the log of birthday and anniversary follow-ups.</summary>
public class OccasionContactConfiguration : IEntityTypeConfiguration<OccasionContact>
{
    public void Configure(EntityTypeBuilder<OccasionContact> builder)
    {
        builder.ToTable("OccasionContacts");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.CustomerId).IsRequired();

        // Stored as its name, matching how every other enum in this schema is persisted.
        builder.Property(c => c.Occasion)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(c => c.OccasionYear).IsRequired();
        builder.Property(c => c.ContactedOn).IsRequired();
        builder.Property(c => c.Remarks).HasMaxLength(1000);

        builder.Property(c => c.CreatedBy).IsRequired();
        builder.Property(c => c.CreatedAtUtc).IsRequired();

        builder.HasOne<Customer>()
            .WithMany()
            .HasForeignKey(c => c.CustomerId)
            .OnDelete(DeleteBehavior.Cascade);

        // One contact record per customer per occasion per year. Marking the same birthday twice is
        // a double-click, not a second conversation — the unique index makes that a no-op the
        // handler can turn into an update rather than a duplicate row nobody notices.
        //
        // Filtered on IsDeleted so a soft-deleted record does not block re-recording the same
        // occasion later.
        builder.HasIndex(c => new { c.CustomerId, c.Occasion, c.OccasionYear })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false");

        // The reports read by occasion and by when contact was made.
        builder.HasIndex(c => c.ContactedOn);
        builder.HasIndex(c => c.IsDeleted);

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
