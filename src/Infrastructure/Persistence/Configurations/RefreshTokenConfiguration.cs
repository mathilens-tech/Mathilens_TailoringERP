using MathilensERP.Domain.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "RefreshTokens" entity (see 02_DATABASE.md § 10 addition alongside the Authentication module).</summary>
public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("RefreshTokens");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.TokenHash)
            .IsRequired()
            .HasMaxLength(512);

        builder.Property(t => t.CreatedBy).IsRequired();
        builder.Property(t => t.CreatedAtUtc).IsRequired();

        // Only the hash is ever persisted or looked up — the raw token never is.
        builder.HasIndex(t => t.TokenHash).IsUnique();
        builder.HasIndex(t => t.UserId);

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
