using MathilensERP.Domain.Marketing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "Campaigns" entity — a marketing message and the customers it is for.</summary>
public class CampaignConfiguration : IEntityTypeConfiguration<Campaign>
{
    public void Configure(EntityTypeBuilder<Campaign> builder)
    {
        builder.ToTable("Campaigns");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(c => c.MessageTemplate)
            .IsRequired()
            .HasMaxLength(2000);

        builder.Property(c => c.CreatedBy).IsRequired();
        builder.Property(c => c.CreatedAtUtc).IsRequired();

        // The worklist of customers hangs off the campaign and is only ever reached through it, so
        // it cascades with its parent. Exposed read-only over a backing field — EF goes through the
        // field rather than the property's absent setter.
        builder.HasMany(c => c.Recipients)
            .WithOne()
            .HasForeignKey(r => r.CampaignId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Metadata.FindNavigation(nameof(Campaign.Recipients))!.SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
