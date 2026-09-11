using MathilensERP.Domain.Customers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "Customers" entity (02_DATABASE.md § 10.3).</summary>
public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("Customers");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.FullName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(c => c.PhoneNumber)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(c => c.Email)
            .HasMaxLength(256);

        builder.Property(c => c.Address)
            .HasMaxLength(500);

        builder.Property(c => c.Notes)
            .HasMaxLength(2000);

        // Stored as their names, matching how every other enum in this schema is persisted —
        // readable in the database and stable if the enum members are ever reordered.
        builder.Property(c => c.Gender)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(c => c.Religion)
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(c => c.DateOfBirth);

        builder.Property(c => c.WeddingDate);

        builder.Property(c => c.CreatedBy).IsRequired();
        builder.Property(c => c.CreatedAtUtc).IsRequired();

        // 02_DATABASE.md § 10.3 Index Recommendations: phone is the primary shop-staff/WhatsApp
        // lookup path, name is the primary search path.
        //
        // Phone is additionally unique: it is the natural key staff, the WhatsApp module and the
        // spreadsheet import all identify a customer by. The application layer reports the clash
        // as a friendly conflict; this index is the backstop that two simultaneous requests can't
        // slip past. Filtered on IsDeleted so a soft-deleted customer doesn't reserve a number
        // forever — the same set of rows the global query filter considers live.
        builder.HasIndex(c => c.PhoneNumber)
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false");
        builder.HasIndex(c => c.FullName);

        // Religion is a filter on the customers list, so it is indexed like the other search paths.
        builder.HasIndex(c => c.Religion);

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
