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

        // Which device's session this token continues. Defaulted to empty at the column so tokens
        // issued before this existed read back without a session rather than null — harmless, since
        // a refresh re-stamps the session and a token minted before sessions is already accepted.
        builder.Property(t => t.SessionId)
            .IsRequired()
            .HasMaxLength(64)
            .HasDefaultValue(string.Empty);

        builder.Property(t => t.CreatedBy).IsRequired();
        builder.Property(t => t.CreatedAtUtc).IsRequired();

        // Only the hash is ever persisted or looked up — the raw token never is.
        builder.HasIndex(t => t.TokenHash).IsUnique();
        builder.HasIndex(t => t.UserId);

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
