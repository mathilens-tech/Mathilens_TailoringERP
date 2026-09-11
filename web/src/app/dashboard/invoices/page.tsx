"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { StatusBadge, INVOICE_STATUS_BADGE } from "@/components/ui/StatusBadge";
import { getAccessToken } from "@/lib/auth";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import { searchInvoices, INVOICE_STATUSES, type DateRange, type Invoice, type InvoiceStatus } from "@/lib/api/billing";
import { getCustomer, type Customer } from "@/lib/api/customers";
import { formatInvoiceDate } from "@/lib/api/invoice-settings";
import { DateInput } from "@/components/ui/DateInput";

/**
 * The shop's own reference — "INV-2026-0001".
 *
 * The fallback is a slice of the id, which is what identified an invoice before numbering existed.
 * The AddInvoiceNumbers migration backfilled every one, so nothing should reach it; it is here so a
 * row can never render an empty cell where its identifier belongs.
 */
function invoiceNumber(invoice: Invoice) {
  return invoice.invoiceNumber?.trim() || `#${invoice.id.slice(0, 8).toUpperCase()}`;
}

const fieldClassName =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

/**
 * The windows staff actually ask for at the counter, plus an explicit range for everything else.
 *
 * <p>Shortest first, with All dates at the end — the list is read in the order the questions get
 * asked, and "everything ever" is the rarest of them.</p>
 */
const DATE_PRESETS = [
  { key: "today", label: "Today", days: 1 },
  { key: "3d", label: "Last 3 days", days: 3 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "all", label: "All dates", days: null },
] as const;

type DatePresetKey = (typeof DATE_PRESETS)[number]["key"] | "custom";

/** yyyy-MM-dd read off the local calendar — "today" has to mean the shop's today, not UTC's. */
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Both ends inclusive: "Last 7 days" is today and the six before it, not today minus seven. */
function presetDates(key: DatePresetKey): { from: string; to: string } {
  const preset = DATE_PRESETS.find((p) => p.key === key);
  const to = new Date();
  const from = new Date();
  if (preset?.days) {
    from.setDate(from.getDate() - (preset.days - 1));
  }
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

/**
 * The picked days as the half-open [from, to) instant range the API expects. The upper bound is
 * the *start of the day after* the To date, so an invoice raised late on the last day is still in
 * range without anyone having to reason about how precise the stored timestamp is.
 */
function toRange(fromDate: string, toDate: string): DateRange {
  const exclusiveEnd = new Date(`${toDate}T00:00:00.000Z`);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
  return {
    fromUtc: new Date(`${fromDate}T00:00:00.000Z`).toISOString(),
    toUtc: exclusiveEnd.toISOString(),
  };
}

export default function InvoicesPage() {
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  // Today, not everything. This screen is opened to see what the shop has taken today far more
  // often than to read its whole billing history, and an unfiltered list grows without bound —
  // every visit would page through years to reach this morning.
  const [datePreset, setDatePreset] = useState<DatePresetKey>("today");
  const [customFrom, setCustomFrom] = useState(() => presetDates("7d").from);
  const [customTo, setCustomTo] = useState(() => presetDates("today").to);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, Customer>>({});
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const range: DateRange =
      datePreset === "all"
        ? { fromUtc: null, toUtc: null }
        : datePreset === "custom"
          ? toRange(customFrom, customTo)
          : (() => {
              const { from, to } = presetDates(datePreset);
              return toRange(from, to);
            })();

    try {
      const token = getAccessToken();
      const { items, meta } = await searchInvoices(null, status || null, page, pageSize, token, range);
      setInvoices(items);
      setMeta(meta);

      // One lookup per distinct customer on the page, not per invoice — a customer with four
      // invoices in the window is one request, not four. Kept across pages, so paging back and
      // forth doesn't re-read names already held. Same shape as the Orders list.
      const uniqueCustomerIds = Array.from(new Set(items.map((invoice) => invoice.customerId)));
      const customers = await Promise.all(
        uniqueCustomerIds.map((customerId) => getCustomer(customerId, token).catch(() => null)),
      );
      setCustomersById((prev) => {
        const next = { ...prev };
        customers.forEach((customer) => {
          if (customer) {
            next[customer.id] = customer;
          }
        });
        return next;
      });
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load invoices.");
    } finally {
      setIsLoading(false);
    }
  }, [status, datePreset, customFrom, customTo, page, pageSize]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInvoices();
  }, [loadInvoices]);

  function handleStatusChange(value: string) {
    setStatus(value as InvoiceStatus | "");
    setPage(1);
  }

  function handleDatePresetChange(value: string) {
    setDatePreset(value as DatePresetKey);
    // A narrower window can be shorter than the page you're on.
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Invoices</h1>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="statusFilter" className="text-sm font-medium">
            Filter by status
          </label>
          <select
            id="statusFilter"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`max-w-xs ${fieldClassName}`}
          >
            <option value="">All Status</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="dateFilter" className="text-sm font-medium">
            Filter by date
          </label>
          <select
            id="dateFilter"
            value={datePreset}
            onChange={(e) => handleDatePresetChange(e.target.value)}
            className={`max-w-xs ${fieldClassName}`}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom range…</option>
          </select>
        </div>

        {/* Only the explicit range needs the two date boxes — the presets already know their dates. */}
        {datePreset === "custom" && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="dateFrom" className="text-sm font-medium">
                From
              </label>
              <DateInput
                id="dateFrom"
                value={customFrom}
                max={customTo}
                onChange={(iso) => {
                  setCustomFrom(iso);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="dateTo" className="text-sm font-medium">
                To
              </label>
              <DateInput
                id="dateTo"
                value={customTo}
                min={customFrom}
                onChange={(iso) => {
                  setCustomTo(iso);
                  setPage(1);
                }}
              />
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-foreground/70">No invoices found.</p>
      ) : (
        <div className="table-wrap overflow-x-auto rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            {/* Tinted like the Orders list, for the same reason: bg-surface is the white the rows
                sit on, so the header had a hairline and nothing else to separate it. */}
            <thead className="border-b border-border bg-primary/10 text-primary">
              <tr>
                {/* Every column sizes to its own content — w-px is a floor the browser has to widen
                    to fit, so with nowrap each lands exactly as wide as its longest cell. Status
                    declares nothing and takes the leftover, which parks the empty space at the far
                    right where it reads as margin. Letting Customer Name absorb it instead opened a
                    hand's width of nothing between a name and the number beside it. */}
                <th className="w-px whitespace-nowrap px-4 py-3 font-semibold">Invoice No.</th>
                <th className="w-px whitespace-nowrap px-4 py-3 font-semibold">Customer Name</th>
                <th className="w-px whitespace-nowrap px-4 py-3 font-semibold">Mobile Number</th>
                <th className="w-px whitespace-nowrap px-4 py-3 font-semibold">Date</th>
                <th className="w-px whitespace-nowrap px-4 py-3 text-right font-semibold">Total</th>
                <th className="w-px whitespace-nowrap px-4 py-3 text-right font-semibold">Paid</th>
                <th className="w-px whitespace-nowrap px-4 py-3 text-right font-semibold">Balance</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const customer = customersById[invoice.customerId];
                return (
                  <tr key={invoice.id} className="border-b border-border last:border-0">
                    {/* The number is the link, so there is no separate View action — it is the
                        reference the customer quotes and the obvious thing to click. */}
                    <td data-label="Invoice No." className="whitespace-nowrap px-4 py-3 font-mono">
                      <Link href={`/dashboard/invoices/${invoice.id}`} className="text-primary hover:underline">
                        {invoiceNumber(invoice)}
                      </Link>
                    </td>
                    <td data-label="Customer Name" className="whitespace-nowrap px-4 py-3">{customer?.fullName ?? "—"}</td>
                    <td data-label="Mobile Number" className="whitespace-nowrap px-4 py-3">{customer?.phoneNumber ?? "—"}</td>
                    {/* dd/MM/yyyy, like the slip and the invoice page. toLocaleDateString follows
                        the browser's locale, so this column read 8/14/2026 while the invoice it
                        links to read 14/08/2026. */}
                    <td data-label="Date" className="whitespace-nowrap px-4 py-3">{formatInvoiceDate(invoice.createdAtUtc)}</td>
                    <td data-label="Total" className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{invoice.totalAmount.toFixed(2)}</td>
                    <td data-label="Paid" className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{invoice.amountPaid.toFixed(2)}</td>
                    {/* Outstanding money is the number worth spotting without reading the row. */}
                    <td data-label="Balance"
                      className={
                        invoice.remainingBalance > 0
                          ? "whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-danger"
                          : "whitespace-nowrap px-4 py-3 text-right tabular-nums"
                      }
                    >
                      {invoice.remainingBalance.toFixed(2)}
                    </td>
                    <td data-label="Status" className="whitespace-nowrap px-4 py-3">
                      <StatusBadge {...INVOICE_STATUS_BADGE[invoice.status]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {meta && <Pagination
          meta={meta}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />}
    </div>
  );
}
