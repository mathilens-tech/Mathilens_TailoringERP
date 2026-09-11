import { apiGet, apiGetPaged } from "@/lib/api-client";

/** One field's before-and-after. `from`/`to` are null where there was no value on that side. */
export type ActivityChange = {
  entity: string;
  field: string;
  from: string | null;
  to: string | null;
};

export type ActivityLog = {
  id: string;
  userId: string | null;
  userName: string | null;
  screen: string;
  action: string;
  requestName: string;
  /** What the action carried — "Full Name: Asha Rao, Phone Number: …". Null for older entries. */
  description: string | null;
  /**
   * What each edited field was changed from and to. Empty for a create or a delete, which have
   * only one side, and for entries recorded before this was captured.
   */
  changes: ActivityChange[];
  occurredAtUtc: string;
};

export type ActivityLogUser = { userId: string; userName: string };

/** Only the values actually present in the log, so a filter can never come back empty by construction. */
export type ActivityLogFilters = { screens: string[]; users: ActivityLogUser[] };

export function searchActivityLogs(
  filters: { fromUtc: string | null; toUtc: string | null; userId: string | null; screen: string | null },
  page: number,
  pageSize: number,
  token: string | null,
) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters.fromUtc) {
    params.set("fromUtc", filters.fromUtc);
  }
  if (filters.toUtc) {
    params.set("toUtc", filters.toUtc);
  }
  if (filters.userId) {
    params.set("userId", filters.userId);
  }
  if (filters.screen) {
    params.set("screen", filters.screen);
  }
  return apiGetPaged<ActivityLog>(`/api/v1/activity-logs?${params}`, token);
}

export function getActivityLogFilters(token: string | null) {
  return apiGet<ActivityLogFilters>("/api/v1/activity-logs/filters", token);
}
