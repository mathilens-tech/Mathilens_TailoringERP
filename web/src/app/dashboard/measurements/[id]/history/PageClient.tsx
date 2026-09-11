"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/Pagination";
import { getAccessToken } from "@/lib/auth";
import { useRouteId } from "@/lib/use-route-id";
import { ApiError, type PaginationMeta } from "@/lib/api-client";
import { getMeasurementHistory, type MeasurementHistoryEntry } from "@/lib/api/measurements";
import { formatMeasurementValue } from "@/lib/api/measurements";


export default function MeasurementHistoryPage() {
  const measurementId = useRouteId(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [entries, setEntries] = useState<MeasurementHistoryEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { items, meta } = await getMeasurementHistory(measurementId, page, pageSize, getAccessToken());
      setEntries(items);
      setMeta(meta);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Unable to load measurement history.");
    } finally {
      setIsLoading(false);
    }
  }, [measurementId, page, pageSize]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Measurement History</h1>
        <Link href="/dashboard/customers" className="text-sm text-foreground/70 hover:text-foreground">
          Back to customers
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-foreground/70">No history recorded yet.</p>
      ) : (
        <div className="table-wrap overflow-x-auto rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium">Recorded</th>
                <th className="px-4 py-3 font-medium">Garment</th>
                <th className="px-4 py-3 font-medium">Values</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0">
                  <td data-label="Recorded" className="px-4 py-3">{new Date(entry.createdAtUtc).toLocaleString()}</td>
                  <td data-label="Garment" className="px-4 py-3">{entry.garmentType}</td>
                  <td data-label="Values" className="px-4 py-3">
                    {Object.entries(entry.values)
                      .map(([name, value]) => `${name}: ${formatMeasurementValue(value)}`)
                      .join(", ")}
                  </td>
                </tr>
              ))}
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
