"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { searchOrders, type OrderStatus } from "@/lib/api/orders";
import { orderStatusLabel } from "@/components/ui/StatusBadge";

// Labels come from the shared map rather than being written again here, so a status renamed once is
// renamed everywhere it appears.
const STATUS_TILES: OrderStatus[] = ["Received", "InProgress", "ReadyForDelivery"];

type Counts = Partial<Record<OrderStatus, number>>;

/** Live counts of orders by status (Received/InProgress/ReadyForDelivery), read from each
 * status filter's pagination meta rather than fetching every order. Used by the Dashboard. */
export function OrderStatusCounts() {
  const [counts, setCounts] = useState<Counts>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = getAccessToken();

    Promise.all(STATUS_TILES.map((status) => searchOrders(null, status, 1, 1, token)))
      .then((results) => {
        if (cancelled) {
          return;
        }
        const next: Counts = {};
        results.forEach(({ meta }, index) => {
          next[STATUS_TILES[index]] = meta.totalCount;
        });
        setCounts(next);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {STATUS_TILES.map((status) => (
        <div key={status} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <span className="text-sm text-foreground/70">{orderStatusLabel(status)}</span>
          <span className="text-2xl font-semibold">{isLoading ? "—" : (counts[status] ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}
