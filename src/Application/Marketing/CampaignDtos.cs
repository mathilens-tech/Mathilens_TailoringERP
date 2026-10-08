namespace MathilensERP.Application.Marketing;

/// <summary>A campaign as the list screen shows it — what it is, how big, and how far through.</summary>
public sealed record CampaignListItemDto(
    Guid Id,
    string Name,
    int RecipientCount,
    int MessagedCount,
    DateTime CreatedAtUtc);

/// <summary>A campaign with its customers, for the screen the shop works down one WhatsApp at a time.</summary>
public sealed record CampaignDto(
    Guid Id,
    string Name,
    string MessageTemplate,
    DateTime CreatedAtUtc,
    IReadOnlyList<CampaignRecipientDto> Recipients);

/// <summary>One customer on a campaign, with the name and number the draft and the button need, and
/// whether they have been messaged yet.</summary>
public sealed record CampaignRecipientDto(
    Guid Id,
    Guid CustomerId,
    string CustomerName,
    string PhoneNumber,
    bool IsMessaged,
    DateTime? MessagedAtUtc);
