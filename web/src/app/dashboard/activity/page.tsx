"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { getAccessToken } from "@/lib/auth";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import { DateInput } from "@/components/ui/DateInput";
import {
  searchActivityLogs,
  getActivityLogFilters,
  type ActivityLog,
  type ActivityLogFilters,
} from "@/lib/api/activity";

// w-full + min-w-0 so a filter is exactly its quarter of the row and nothing else. A <select> is
// otherwise as wide as its longest option, and this page's User list holds whole email addresses —
// one long enough to push the Screen filter off the side of the screen.
const fieldClassName =
  "w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

/** The two dropdowns, whose options can be longer than the space they get — shown clipped, not wide. */
const selectClassName = `${fieldClassName} truncate`;

/**
 * Where each recorded area sits in the menu.
 *
 * The log stores the code's own name for the area — "Billing", "Pricing", "Auth" — which is not
 * what anyone reading it has ever seen on screen. Mapped here rather than at the point of writing
 * so entries recorded before this existed read correctly too, and so renaming a menu item is a
 * one-line change in one place.
 */
const MENU_LOCATION: Record<string, { module: string; screen: string }> = {
  Orders: { module: "Orders", screen: "Orders" },
  Customers: { module: "Customers", screen: "Customers" },
  Measurements: { module: "Customers", screen: "Measurements" },
  Billing: { module: "Invoices", screen: "Invoices" },
  Invoices: { module: "Invoices", screen: "Invoices" },
  Pricing: { module: "Inventory", screen: "Fabric Details" },
  Inventory: { module: "Inventory", screen: "Inventory Transaction" },
  Reports: { module: "Reports", screen: "Reports" },
  Occasions: { module: "Reports", screen: "Birthday & Wedding" },
  WhatsApp: { module: "WhatsApp", screen: "WhatsApp" },
  Employees: { module: "User Management", screen: "Employees" },
  Auth: { module: "User Management", screen: "Users" },
  Users: { module: "User Management", screen: "Users" },
  Authorization: { module: "User Management", screen: "User Rights" },
  Activity: { module: "User Management", screen: "Activity Log" },
  Settings: { module: "Settings", screen: "Settings" },
};

/** Falls back to the stored name, so an area added later reads sensibly before it is mapped. */
function locationOf(screen: string) {
  return MENU_LOCATION[screen] ?? { module: screen, screen };
}

/**
 * A picked day covers the whole of that day. Sending the To date's midnight would exclude
 * everything that happened on it — the same trap the Reports page fell into.
 */
function toInstant(date: string, endOfDay: boolean): string | null {
  if (!date) {
    return null;
  }
  return new Date(`${date}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`).toISOString();
}

/**
 * What one entry did, as one line of labels and their values.
 *
 * An edit reads "Phone Number: 98765 43210 → 91234 56789"; a create or a delete has only one side,
 * so it falls back to the values the action carried. Kept to a single line on purpose: one action
 * is one row, and a bulleted list of changed fields turned a single edit into six lines of table
 * that scanned like six separate events.
 */
function describe(log: ActivityLog): string {
  if (log.changes.length > 0) {
    return log.changes
      .map((change) => `${change.field}: ${change.from ?? "empty"} → ${change.to ?? "empty"}`)
      .join(" · ");
  }

  return log.description ?? "—";
}

export default function ActivityLogPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [userId, setUserId] = useState("");
  const [screen, setScreen] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [filters, setFilters] = useState<ActivityLogFilters>({ screens: [], users: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { items, meta } = await searchActivityLogs(
        {
          fromUtc: toInstant(fromDate, false),
          toUtc: toInstant(toDate, true),
          userId: userId || null,
          screen: screen || null,
        },
        page,
        pageSize,
        getAccessToken(),
      );
      setLogs(items);
      setMeta(meta);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load the activity log.");
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, userId, screen, page, pageSize]);

  const loadFilters = useCallback(async () => {
    // Filter options are a convenience; failing to load them shouldn't take the page down.
    setFilters(await getActivityLogFilters(getAccessToken()).catch(() => ({ screens: [], users: [] })));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFilters();
  }, [loadFilters]);

  /** Any filter change re-narrows the list, so page 1 is the only sensible place to land. */
  function applyFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Activity Log</h1>

      {/* The two dates need only as much room as "mm/dd/yyyy" and its calendar button; the two
          dropdowns hold email addresses and screen names and can use everything left over. Equal
          quarters gave the dates half the row for ten characters and squeezed the rest. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[9.5rem_9.5rem_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="fromDate" className="text-sm font-medium">
            From
          </label>
          <DateInput id="fromDate" value={fromDate} onChange={(iso) => applyFilter(() => setFromDate(iso))} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="toDate" className="text-sm font-medium">
            To
          </label>
          <DateInput id="toDate" value={toDate} onChange={(iso) => applyFilter(() => setToDate(iso))} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="userFilter" className="text-sm font-medium">
            User
          </label>
          <select
            id="userFilter"
            value={userId}
            onChange={(e) => applyFilter(() => setUserId(e.target.value))}
            className={selectClassName}
          >
            <option value="">All users</option>
            {filters.users.map((user) => (
              <option key={user.userId} value={user.userId}>
                {user.userName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="screenFilter" className="text-sm font-medium">
            Screen
          </label>
          <select
            id="screenFilter"
            value={screen}
            onChange={(e) => applyFilter(() => setScreen(e.target.value))}
            className={selectClassName}
          >
            <option value="">All screens</option>
            {/* The stored key is the value, the menu name is what is read — otherwise the filter
                offers "Billing" for a screen the menu calls Invoices. */}
            {filters.screens.map((option) => (
              <option key={option} value={option}>
                {locationOf(option).screen}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-foreground/70">No activity recorded for these filters.</p>
      ) : (
        <div className="table-wrap rounded-lg border border-border">
          {/* table-fixed, so the columns are the widths declared below and nothing else. Under the
              browser's own (automatic) layout every column was as wide as the longest thing in it,
              which meant the whole table changed shape with the data: one long email address or one
              description of a price change and the table outgrew the page, taking the filter row
              above it along — the Screen filter ended up off the side of the screen.

              Percentages rather than rem, so the seven columns always add up to exactly the space
              available and the table can never be wider than the box it sits in, at any window size.
              Content too long for its share wraps, which is why nothing here is nowrap any more. */}
          <table className="stacked w-full table-fixed text-left text-sm">
            {/* Off below md, where .stacked turns every row into a card and there are no columns
                left for a ruler to measure. */}
            <colgroup className="hidden md:table-column-group">
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[17%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[29%]" />
            </colgroup>
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                {/* No zone in the heading. The times are the reader's own clock, which is the only
                    one they were ever going to read it as. */}
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Module</th>
                <th className="px-4 py-3 font-medium">Screen</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const occurred = new Date(log.occurredAtUtc);
                const location = locationOf(log.screen);
                return (
                  <tr key={log.id} className="border-b border-border last:border-0">
                    {/* break-words on every cell: a column is now a fixed share of the table, so
                        anything that does not fit has to wrap inside it rather than widen it. It
                        earns its keep on the unbroken strings this log is full of — an email
                        address, a GUID, a cloth code — which have no space to wrap at. */}
                    <td data-label="Date" className="px-4 py-3 break-words">
                      {occurred.toLocaleDateString()}
                    </td>
                    <td data-label="Time" className="px-4 py-3 break-words">
                      {occurred.toLocaleTimeString()}
                    </td>
                    <td data-label="User" className="px-4 py-3 break-words">
                      {log.userName ?? "—"}
                    </td>
                    <td data-label="Module" className="px-4 py-3 break-words">
                      {location.module}
                    </td>
                    <td data-label="Screen" className="px-4 py-3 break-words">
                      {location.screen}
                    </td>
                    <td data-label="Action" className="px-4 py-3 break-words">
                      {log.action}
                    </td>
                    {/* The widest column by far, and the one that actually needs the room — a long
                        edit reads as several "field: from → to" pairs. It wraps to as many lines as
                        it takes; it is still one entry on one row. */}
                    <td data-label="Description" className="px-4 py-3 break-words text-foreground/80">
                      {describe(log)}
                    </td>
                  </tr>
                );
              })}
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
