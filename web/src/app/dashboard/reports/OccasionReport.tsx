"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ExportButton } from "@/components/ui/ExportButton";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import { usePermissions } from "@/lib/use-permissions";
import { PERMISSIONS } from "@/lib/api/users";
import {
  searchOccasions,
  recordOccasionContact,
  type OccasionRow,
  type OccasionScope,
  type OccasionType,
} from "@/lib/api/occasions";
import { toDisplayPhoneNumber } from "@/lib/contact";

const fieldClassName =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

/**
 * A full year, which is what "All" means here rather than a synonym for "no limit".
 *
 * Birthdays and anniversaries come round annually, so every customer holding a date has one falling
 * inside the next 365 days — for "Still to call" this genuinely is everything. For "Already
 * contacted" it reads as the last year, which is the one honest limit: the API clamps the window to
 * 365 on purpose, because an unbounded one stops being a call sheet and becomes the customer list.
 */
const ALL_WINDOW_DAYS = 365;

/** The shop asked for thirty days either way; the others are here because a season is not a month. */
const WINDOW_OPTIONS = [
  { days: ALL_WINDOW_DAYS, label: "All" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
] as const;

/** yyyy-MM-dd off the local calendar — "today" has to mean the shop's today, not UTC's. */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** "Today", "Tomorrow", "in 6 days" — a countdown reads faster than a date when the list is a call sheet. */
function whenLabel(daysAway: number): string {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  if (daysAway > 1) return `in ${daysAway} days`;
  if (daysAway === -1) return "Yesterday";
  return `${Math.abs(daysAway)} days ago`;
}

/**
 * The Birthday and Wedding reports.
 *
 * One component for both: they differ only in which date they read and what the milestone is
 * called, and keeping them as one screen means a fix to the follow-up flow cannot land on only one
 * of them.
 */
export function OccasionReport({
  occasion,
  title,
  description,
  milestoneLabel,
}: {
  occasion: OccasionType;
  title: string;
  description: string;
  /** What the number of years means here — "Turning" for a birthday, "Years" for an anniversary. */
  milestoneLabel: string;
}) {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canRecord = can(PERMISSIONS.customersEdit);

  const [scope, setScope] = useState<OccasionScope>("Upcoming");
  // Opens on the whole year rather than the next thirty days, so nothing is hidden behind a window
  // the reader did not choose. Narrower windows remain in the select for working a shorter list.
  const [windowDays, setWindowDays] = useState<number>(ALL_WINDOW_DAYS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [rows, setRows] = useState<OccasionRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The row being marked, and the remarks being typed against it. Held per-row rather than in a
  // dialog so the shop can work down the list without a modal opening and closing each time.
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { items, meta } = await searchOccasions(occasion, scope, windowDays, page, pageSize, getAccessToken());
      setRows(items);
      setMeta(meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load this report.");
    } finally {
      setIsLoading(false);
    }
  }, [occasion, scope, windowDays, page, pageSize]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSave(row: OccasionRow) {
    setIsSaving(true);
    try {
      await recordOccasionContact(
        {
          customerId: row.customerId,
          occasion,
          // From the row, not from today — see recordOccasionContact.
          occasionYear: new Date(row.occasionOn).getFullYear(),
          contactedOn: todayIso(),
          remarks: remarks.trim() || null,
        },
        getAccessToken(),
      );
      showToast(`${row.fullName} marked as contacted.`);
      setOpenRow(null);
      setRemarks("");
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Unable to save this.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function changeScope(next: OccasionScope) {
    setScope(next);
    setPage(1);
    setOpenRow(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-foreground/70">{description}</p>
        </div>
        {/* Carries the current filters, so the file matches what is on screen rather than the
            unfiltered set — handing somebody the wrong call sheet is worse than no call sheet. */}
        <ExportButton
          resource="occasions"
          label="this report"
          query={{ occasion, scope, windowDays: String(windowDays) }}
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap gap-2">
          {(["Upcoming", "Contacted"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => changeScope(option)}
              aria-pressed={scope === option}
              className={
                scope === option
                  ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-full border border-border px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:border-primary hover:text-foreground"
              }
            >
              {option === "Upcoming" ? "Still to call" : "Already contacted"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="windowDays" className="text-sm font-medium">
            {scope === "Upcoming" ? "Coming up within" : "Contacted within the last"}
          </label>
          <select
            id="windowDays"
            value={windowDays}
            onChange={(e) => {
              setWindowDays(Number(e.target.value));
              setPage(1);
            }}
            className={fieldClassName}
          >
            {WINDOW_OPTIONS.map((option) => (
              <option key={option.days} value={option.days}>
                {/* "All" is the whole truth for the upcoming list, because every annual occasion
                    falls inside a year. On the contacted list it is capped at a year, and saying so
                    here is cheaper than someone wondering why an older call is missing. */}
                {option.days === ALL_WINDOW_DAYS && scope === "Contacted" ? "All (last 12 months)" : option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-foreground/70">
          {scope === "Upcoming"
            ? `Nobody to call in the next ${windowDays} days.`
            : `Nobody contacted in the last ${windowDays} days.`}
        </p>
      ) : (
        <div className="table-wrap overflow-x-auto rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">{milestoneLabel}</th>
                <th className="px-4 py-3 font-medium">{scope === "Upcoming" ? "" : "Contacted"}</th>
                <th className="px-4 py-3 font-medium">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.customerId} className="border-b border-border align-top last:border-0">
                  <td data-label="Customer" className="px-4 py-3">{row.fullName}</td>
                  <td data-label="Phone" className="px-4 py-3 text-foreground/70">{toDisplayPhoneNumber(row.phoneNumber)}</td>
                  <td data-label="Date" className="px-4 py-3">{new Date(row.occasionOn).toLocaleDateString()}</td>
                  <td data-label="When" className="px-4 py-3 text-foreground/70">{whenLabel(row.daysAway)}</td>
                  <td data-label={milestoneLabel} className="px-4 py-3 text-foreground/70">{row.yearsCompleted ?? "—"}</td>
                  <td data-label={scope === "Upcoming" ? "" : "Contacted"} className="px-4 py-3">
                    {row.contactedOn ? new Date(row.contactedOn).toLocaleDateString() : ""}
                  </td>
                  <td data-label="Remarks" className="px-4 py-3">
                    {openRow === row.customerId ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          rows={2}
                          placeholder="What was said, or what they ordered"
                          className={`${fieldClassName} w-64`}
                          aria-label={`Remarks for ${row.fullName}`}
                        />
                        <div className="flex gap-2">
                          <Button type="button" onClick={() => handleSave(row)} disabled={isSaving} className="px-3 py-1.5 text-xs">
                            {isSaving ? "Saving…" : "Save"}
                          </Button>
                          <button
                            type="button"
                            onClick={() => setOpenRow(null)}
                            className="text-xs text-foreground/70 hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <span className="text-foreground/70">{row.remarks ?? "—"}</span>
                        {canRecord && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenRow(row.customerId);
                              setRemarks(row.remarks ?? "");
                            }}
                            className="shrink-0 text-xs text-primary hover:underline"
                          >
                            {row.isContacted ? "Edit" : "Mark contacted"}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && (
        <Pagination
          meta={meta}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
