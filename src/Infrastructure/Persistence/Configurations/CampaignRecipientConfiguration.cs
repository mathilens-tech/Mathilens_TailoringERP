using MathilensERP.Domain.Marketing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MathilensERP.Infrastructure.Persistence.Configurations;

/// <summary>Realizes the "CampaignRecipients" entity — one customer on a campaign, messaged or not.</summary>
public class CampaignRecipientConfiguration : IEntityTypeConfiguration<CampaignRecipient>
{
    public void Configure(EntityTypeBuilder<CampaignRecipient> builder)
    {
        builder.ToTable("CampaignRecipients");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.CampaignId).IsRequired();
        builder.Property(r => r.CustomerId).IsRequired();

        // Nullable: null is "not yet messaged", which is where every recipient starts.
        builder.Property(r => r.MessagedAtUtc);

        builder.Property(r => r.CreatedBy).IsRequired();
        builder.Property(r => r.CreatedAtUtc).IsRequired();

        // The FK to Campaign is configured on CampaignConfiguration's Recipients navigation. This
        // index serves the other lookup — a recipient resolved to its customer for the display.
        builder.HasIndex(r => r.CampaignId);
        builder.HasIndex(r => r.CustomerId);

        builder.Property<uint>("xmin").IsRowVersion();
    }
}
