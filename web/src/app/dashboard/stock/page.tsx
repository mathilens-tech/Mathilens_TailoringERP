"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getAccessToken } from "@/lib/auth";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import { getStockSummary, type StockSummary } from "@/lib/api/inventory";

/**
 * Stock per cloth code.
 *
 * The figure is everything received, not a balance: nothing in the system records cloth leaving
 * the shop — orders do not store which cloth code they consumed, and there is no issue entry — so
 * this can only ever grow. The screen says so rather than presenting a number that quietly drifts
 * from the shelf.
 */
export default function StockDetailsPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [rows, setRows] = useState<StockSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { items, meta } = await getStockSummary(debouncedSearch, page, pageSize, getAccessToken());
      setRows(items);
      setMeta(meta);
    } catch (error) {
      // Says what actually went wrong rather than only that something did. "Unable to load stock
      // details." was shown for every failure that was not an ApiError, which is precisely the set
      // of failures nobody can act on without opening the network tab — a request that never
      // completed, or a response that did not parse. Naming it is the difference between a report
      // that can be fixed and one that can only be reproduced.
      setLoadError(
        error instanceof ApiError
          ? error.message
          : `Unable to load stock details. ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, page, pageSize]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Stock Details</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Quantity received per cloth code, from the{" "}
          <Link href="/dashboard/inventory" className="text-primary hover:underline">
            Inventory
          </Link>{" "}
          receipts.
        </p>
      </div>

      <div className="max-w-md">
        <Input
          id="search"
          label="Search by cloth code or name"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          placeholder="Search stock…"
          autoCapitalize="none"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-foreground/70">
          Nothing received yet. Record a delivery on the Inventory screen and it will appear here.
        </p>
      ) : (
        <div className="table-wrap overflow-x-auto rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium">Cloth Code</th>
                <th className="px-4 py-3 font-medium">Available Quantity</th>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Last received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.clothPriceId} className="border-b border-border last:border-0">
                  <td data-label="Cloth Code" className="px-4 py-3">
                    <span className="font-mono">{row.clothCode}</span>
                    <span className="text-foreground/60"> — {row.clothName}</span>
                  </td>
                  {/* One line per unit throughout: 12.5 metres and 3 rolls are two facts, not
                      15.5 of anything. */}
                  <td data-label="Available Quantity" className="px-4 py-3">
                    <div className="flex flex-col">
                      {row.quantities.map((q) => (
                        <span
                          key={q.unit}
                          // Negative means more was issued than ever arrived — a real bookkeeping
                          // mistake, so it is coloured rather than quietly shown as a small number.
                          className={`whitespace-nowrap font-medium ${q.available < 0 ? "text-danger" : ""}`}
                        >
                          {q.available.toFixed(2)} {q.unit.toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td data-label="Received" className="px-4 py-3 text-foreground/70">
                    <div className="flex flex-col">
                      {row.quantities.map((q) => (
                        <span key={q.unit} className="whitespace-nowrap">
                          {q.received.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td data-label="Used" className="px-4 py-3 text-foreground/70">
                    <div className="flex flex-col">
                      {row.quantities.map((q) => (
                        <span key={q.unit} className="whitespace-nowrap">
                          {q.used.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td data-label="Last received" className="px-4 py-3 whitespace-nowrap text-foreground/70">
                    {row.lastReceivedOn ? new Date(`${row.lastReceivedOn}T00:00:00Z`).toLocaleDateString() : "—"}
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
