import { apiDelete, apiGet, apiGetPaged, apiPut } from "@/lib/api-client";

export type Setting = {
  id: string;
  key: string;
  value: string;
  createdAtUtc: string;
  lastModifiedAtUtc: string | null;
};

/** Shop owners configure this via the Settings page — its value is the number of days to add
 * to today's date when pre-filling a new order's due date (00_MASTER_SPEC.md § 9 — different
 * shops commit to different turnaround times, so this isn't hardcoded). */
export const DEFAULT_ORDER_DUE_DATE_DAYS_KEY = "Orders.DefaultDueDateDurationDays";

/** What every order number starts with, before the running count — "MTL" gives "MTL-0001". Read by
 * the server when it issues a number, so this string is mirrored in Shared/Constants/SettingKeys.cs
 * and the two have to agree. */
export const ORDER_NUMBER_PREFIX_KEY = "Orders.NumberPrefix";

/** Letterhead details for the printable invoice — configured via the Settings page's generic
 * key/value store (same mechanism as the due-date default above) rather than hardcoded, since
 * each shop has its own name and contact number. */
export const SHOP_NAME_KEY = "Shop.Name";
export const SHOP_CONTACT_NUMBER_KEY = "Shop.ContactNumber";

/** One key per garment type, holding its measurement points as a JSON array in display order.
 * Written and read through the Measurements endpoints (see `@/lib/api/measurements`), not here —
 * this prefix exists so the raw key/value list can hide rows that have their own editor. */
export const MEASUREMENT_TEMPLATE_KEY_PREFIX = "Measurements.Template.";

export function listSettings(page: number, pageSize: number, token: string | null) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiGetPaged<Setting>(`/api/v1/settings?${params}`, token);
}

export function getSetting(key: string, token: string | null) {
  return apiGet<Setting>(`/api/v1/settings/${encodeURIComponent(key)}`, token);
}

export function upsertSetting(key: string, value: string, token: string | null) {
  return apiPut<Setting>(`/api/v1/settings/${encodeURIComponent(key)}`, { value }, token);
}

export function deleteSetting(key: string, token: string | null) {
  return apiDelete(`/api/v1/settings/${encodeURIComponent(key)}`, token);
}
