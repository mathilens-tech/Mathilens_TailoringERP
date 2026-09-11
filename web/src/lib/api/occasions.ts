import { apiGetPaged, apiPostNoContent } from "@/lib/api-client";

export type OccasionType = "Birthday" | "WeddingAnniversary";

/** Upcoming = who still needs calling. Contacted = who has been called, and what came of it. */
export type OccasionScope = "Upcoming" | "Contacted";

export type OccasionRow = {
  customerId: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  /** This year's occurrence, not the stored date of birth or wedding date. */
  occasionOn: string;
  /** Negative once the occasion has passed. */
  daysAway: number;
  /** How old they turn, or which anniversary — null when the stored year is a placeholder. */
  yearsCompleted: number | null;
  isContacted: boolean;
  contactedOn: string | null;
  remarks: string | null;
};

export function searchOccasions(
  occasion: OccasionType,
  scope: OccasionScope,
  windowDays: number,
  page: number,
  pageSize: number,
  token: string | null,
) {
  const params = new URLSearchParams({
    occasion,
    scope,
    windowDays: String(windowDays),
    page: String(page),
    pageSize: String(pageSize),
  });
  return apiGetPaged<OccasionRow>(`/api/v1/occasions?${params}`, token);
}

/**
 * Marks an occasion as followed up, or amends the remarks.
 *
 * `occasionYear` comes from the row rather than from today's date: a call logged on 2 January about
 * a 30 December birthday belongs to the old year's occurrence.
 */
export function recordOccasionContact(
  input: {
    customerId: string;
    occasion: OccasionType;
    occasionYear: number;
    contactedOn: string;
    remarks: string | null;
  },
  token: string | null,
) {
  return apiPostNoContent("/api/v1/occasions/contacts", input, token);
}
