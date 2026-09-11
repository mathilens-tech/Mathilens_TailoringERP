"use client";

import { useCallback, useEffect, useState } from "react";
import { ExportButton } from "@/components/ui/ExportButton";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { getRevenueReport, type RevenueReport } from "@/lib/api/reports";
import { ReportRangeFilter, StatFigures, toUtcRange, useReportRange } from "../ReportRange";

/** Invoices raised in a period — the billing position, which differs from order value. */
export default function RevenueReportPage() {
  const range = useReportRange();
  const [data, setData] = useState<RevenueReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { fromDate, toDate } = range;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { fromUtc, toUtc } = toUtcRange(fromDate, toDate);
      setData(await getRevenueReport(fromUtc, toUtc, getAccessToken()));
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
        <h1 className="text-2xl font-semibold">Revenue</h1>
        {/* Carries the range on screen, so the file covers the same period. */}
        <ExportButton
          resource="reports"
          label="this report"
          query={{ report: "revenue", ...toUtcRange(fromDate, toDate) }}
        />
      </div>

      <ReportRangeFilter range={range} />

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : data ? (
        <StatFigures
          figures={[
            {
              label: "Invoices",
              value: String(data.invoiceCount),
              description: "Bills raised in this period, by invoice date.",
            },
            {
              label: "Invoiced",
              value: data.totalInvoiced.toFixed(2),
              description: "Their total value, after discount and including tax.",
            },
            {
              label: "Collected",
              value: data.totalCollected.toFixed(2),
              description: "Money actually received against those invoices.",
            },
            {
              label: "Outstanding",
              value: data.totalOutstanding.toFixed(2),
              description: "Still owed on them — invoiced less collected.",
            },
          ]}
        />
      ) : null}
    </div>
  );
}
