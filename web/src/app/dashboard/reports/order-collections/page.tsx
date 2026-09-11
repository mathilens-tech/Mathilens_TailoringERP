"use client";

import { useCallback, useEffect, useState } from "react";
import { ExportButton } from "@/components/ui/ExportButton";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { getOrderCollectionsReport, type OrderCollectionsReport } from "@/lib/api/reports";
import { ReportRangeFilter, StatFigures, toUtcRange, useReportRange } from "../ReportRange";

/** Orders booked in a period, and how much of that money has actually come in. */
export default function OrderCollectionsReportPage() {
  const range = useReportRange();
  const [data, setData] = useState<OrderCollectionsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { fromDate, toDate } = range;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { fromUtc, toUtc } = toUtcRange(fromDate, toDate);
      setData(await getOrderCollectionsReport(fromUtc, toUtc, getAccessToken()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load this report.");
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">Orders</h1>
        {/* Carries the range on screen, so the file covers the same period. */}
        <ExportButton
          resource="reports"
          label="this report"
          query={{ report: "order-collections", ...toUtcRange(fromDate, toDate) }}
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
              label: "Orders",
              value: String(data.orderCount),
              description: "Orders booked in this period, cancelled ones included.",
            },
            {
              label: "Order value",
              value: data.orderValue.toFixed(2),
              description: "Quantity × price, whether or not a bill has been raised. Excludes cancelled.",
            },
            {
              label: "Delivered value",
              value: data.deliveredValue.toFixed(2),
              description: "The share of that value already handed over to the customer.",
            },
            {
              label: "Collected",
              value: data.collectedAmount.toFixed(2),
              description: "Money actually received against these orders.",
            },
            {
              label: "Pending",
              value: data.pendingAmount.toFixed(2),
              description: "Still to come in: unpaid bills, plus work not yet billed.",
            },
            {
              label: "Cancelled",
              value: data.cancelledValue.toFixed(2),
              description: "Value of cancelled orders. Counted here and in no other figure.",
            },
            {
              label: "Discounts given",
              value: data.discountsGiven.toFixed(2),
              description: "Reductions applied on the invoices for these orders.",
            },
          ]}
        />
      ) : null}
    </div>
  );
}
