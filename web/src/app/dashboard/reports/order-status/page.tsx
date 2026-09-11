"use client";

import { useCallback, useEffect, useState } from "react";
import { ExportButton } from "@/components/ui/ExportButton";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { getOrderStatusSummaryReport, type OrderStatusSummaryReport } from "@/lib/api/reports";
import { orderStatusLabel } from "@/components/ui/StatusBadge";
import { ReportRangeFilter, toUtcRange, useReportRange } from "../ReportRange";

/** How many orders sit at each status in the chosen period. */
export default function OrderStatusReportPage() {
  const range = useReportRange();
  const [data, setData] = useState<OrderStatusSummaryReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { fromDate, toDate } = range;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { fromUtc, toUtc } = toUtcRange(fromDate, toDate);
      setData(await getOrderStatusSummaryReport(fromUtc, toUtc, getAccessToken()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load this report.");
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">Order Status</h1>
        {/* Carries the range on screen, so the file covers the same period. */}
        <ExportButton
          resource="reports"
          label="this report"
          query={{ report: "order-status", ...toUtcRange(fromDate, toDate) }}
        />
      </div>

      <ReportRangeFilter range={range} />

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : !data || data.statusCounts.length === 0 ? (
        <p className="text-sm text-foreground/70">No orders in this period.</p>
      ) : (
        /* Not `stacked`: two columns of one word and one number are a table at any width, and
           breaking them into a card each made a short report long. */
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-hover">
              <tr>
                <th className="px-3 py-2 font-medium sm:px-4 sm:py-3">Status</th>
                <th className="px-3 py-2 text-right font-medium sm:px-4 sm:py-3">Count</th>
              </tr>
            </thead>
            <tbody>
              {data.statusCounts.map((row) => (
                <tr key={row.status} className="border-b border-border last:border-0">
                  {/* Through the shared label map — this table used to print the raw enum. */}
                  <td className="px-3 py-2 sm:px-4 sm:py-3">{orderStatusLabel(row.status)}</td>
                  <td className="px-3 py-2 text-right tabular-nums sm:px-4 sm:py-3">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
