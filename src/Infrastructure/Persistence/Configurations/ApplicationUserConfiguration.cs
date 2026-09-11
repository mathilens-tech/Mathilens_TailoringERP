using MathilensERP.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "Users" entity documented in 02_DATABASE.md § 10.1.</summary>
public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        // 02_DATABASE.md § 4.1 Table Naming: PascalCase, plural noun — not Identity's
        // default "AspNetUsers".
        builder.ToTable("Users");

        // 02_DATABASE.md § 7 Concurrency — PostgreSQL's native xmin system column,
        // exposed as a shadow property (no corresponding CLR property needed).
        builder.Property<uint>("xmin").IsRowVersion();

        builder.Property(u => u.CreatedBy).IsRequired();
        builder.Property(u => u.CreatedAtUtc).IsRequired();

        // Optional: accounts created before this column existed have no name to put in it, and the
        // screens fall back to the email. 100 matches Customers.FullName, since it is the same kind
        // of thing written by the same people.
        builder.Property(u => u.FullName).HasMaxLength(100);

        // 02_DATABASE.md § 10.1 Index Recommendations.
        builder.HasIndex(u => u.IsDeleted);
    }
}
