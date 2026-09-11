"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge, ORDER_STATUS_BADGE } from "@/components/ui/StatusBadge";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { usePermissions } from "@/lib/use-permissions";
import { PERMISSIONS } from "@/lib/api/users";
import { searchOrders, type Order } from "@/lib/api/orders";

/** dd/MM/yyyy, assembled by hand — toLocaleDateString follows the browser, so one counter read 19/08/2026 and another 8/19/2026. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/**
 * Enough to recognise a customer's history at a glance, not the whole order list.
 *
 * Newest first and capped: somebody opening a customer wants "what have we made for them lately",
 * and paging a panel that sits above their measurements would bury those. The count above the
 * table says when there are more, so a short list is never mistaken for the whole history.
 */
const RECENT_ORDER_COUNT = 10;

/** Embedded in the customer detail page, beside their details and their measurements. */
export function PreviousOrdersSection({ customerId }: { customerId: string }) {
  const { can, isLoaded } = usePermissions();
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The orders endpoint demands Orders.View, so a Tailor reading a customer would get a 403 and a
  // panel of red text about a thing they were never meant to see. The section is dropped instead.
  const canViewOrders = isLoaded && can(PERMISSIONS.ordersView);

  useEffect(() => {
    if (!canViewOrders) {
      return;
    }

    let cancelled = false;

    searchOrders(customerId, null, 1, RECENT_ORDER_COUNT, getAccessToken())
      .then(({ items, meta }) => {
        if (!cancelled) {
          setOrders(items);
          setTotalCount(meta.totalCount);
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setLoadError(error instanceof ApiError ? error.message : "Unable to load this customer's orders.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, canViewOrders]);

  if (!canViewOrders) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Previous orders</h2>
        {totalCount > orders.length && (
          <span className="text-xs text-foreground/60">
            Showing the {orders.length} most recent of {totalCount}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-foreground/70">No orders yet for this customer.</p>
      ) : (
        <div className="table-wrap rounded-lg border border-border">
          <table className="stacked w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-hover">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Collection</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const badge = ORDER_STATUS_BADGE[order.status];
                return (
                  <tr key={order.id} className="border-b border-border last:border-0">
                    <td data-label="Order" className="px-3 py-2">
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td data-label="Status" className="px-3 py-2">
                      <StatusBadge label={badge?.label ?? order.status} tone={badge?.tone ?? "neutral"} />
                    </td>
                    <td data-label="Collection" className="px-3 py-2 whitespace-nowrap">{formatDate(order.dueAtUtc)}</td>
                    <td data-label="Total" className="px-3 py-2 text-right tabular-nums">
                      {order.totalAmount.toFixed(2)}
                    </td>
                    {/* Null means billing was never consulted, which is not the same as nothing
                        owed — a search always populates it, so this is only a guard. */}
                    <td data-label="Balance" className="px-3 py-2 text-right tabular-nums">
                      {order.balanceAmount === null ? "—" : order.balanceAmount.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
