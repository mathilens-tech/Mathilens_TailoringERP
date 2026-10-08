import { apiGet, apiPost, apiPutNoContent } from "@/lib/api-client";

export type CampaignListItem = {
  id: string;
  name: string;
  /** How many customers are on the campaign. */
  recipientCount: number;
  /** How many of them have been messaged so far. */
  messagedCount: number;
  createdAtUtc: string;
};

export type CampaignRecipient = {
  id: string;
  customerId: string;
  customerName: string;
  /** As stored, e.g. "+919940942083". Cleaned to digits where a wa.me link is built. */
  phoneNumber: string;
  isMessaged: boolean;
  messagedAtUtc: string | null;
};

export type Campaign = {
  id: string;
  name: string;
  /** The message, with an optional {name} token replaced per customer when a draft is built. */
  messageTemplate: string;
  createdAtUtc: string;
  recipients: CampaignRecipient[];
};

export type CreateCampaignInput = { name: string; messageTemplate: string; customerIds: string[] };

export function listCampaigns(token: string | null) {
  return apiGet<CampaignListItem[]>("/api/v1/campaigns", token);
}

export function getCampaign(id: string, token: string | null) {
  return apiGet<Campaign>(`/api/v1/campaigns/${id}`, token);
}

export function createCampaign(input: CreateCampaignInput, token: string | null) {
  return apiPost<Campaign>("/api/v1/campaigns", input, token);
}

export function setRecipientMessaged(campaignId: string, recipientId: string, messaged: boolean, token: string | null) {
  return apiPutNoContent(`/api/v1/campaigns/${campaignId}/recipients/${recipientId}/messaged`, { messaged }, token);
}

/**
 * The message as it will be drafted to one customer: every {name} token replaced with their name.
 *
 * <p>Case-insensitive on the token and global, so "Hi {name}, {NAME}" both fill in. A template with
 * no token is returned unchanged — a plain message to everyone is as valid as a personalised one.</p>
 */
export function personalizeMessage(template: string, customerName: string): string {
  return template.replace(/\{name\}/gi, customerName);
}
