using MathilensERP.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "Roles" entity documented in 02_DATABASE.md § 10.2.</summary>
public class ApplicationRoleConfiguration : IEntityTypeConfiguration<ApplicationRole>
{
    public void Configure(EntityTypeBuilder<ApplicationRole> builder)
    {
        builder.ToTable("Roles");
        builder.Property<uint>("xmin").IsRowVersion();

        builder.Property(r => r.CreatedBy).IsRequired();
        builder.Property(r => r.CreatedAtUtc).IsRequired();
    }
}
