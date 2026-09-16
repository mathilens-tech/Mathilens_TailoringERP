"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/auth";
import {
  listMeasurementsForCustomer,
  toDisplayEntries,
  type Measurement,
} from "@/lib/api/measurements";
import { useMeasurementTemplates } from "@/lib/use-measurement-templates";
import type { OrderItem } from "@/lib/api/orders";

/**
 * What each garment on the order is to be cut to, on the order's own screen.
 *
 * The figures were only ever visible while the order was being written — once it was saved, the
 * tailor who actually stitches it had to leave the order, find the customer and open the right
 * garment to read them. This is the same set, where the work is.
 *
 * <p><b>These are the customer's measurements as they stand now, not a snapshot taken when the
 * order was placed.</b> An order does not carry its own copy: `OrderItem` names a garment type and
 * nothing more, and the values live on the customer keyed by that garment. So re-measuring a
 * customer changes what an older order displays. That is usually what a tailor wants — the newest
 * figures are the ones to cut to — but it is emphatically not an audit trail, which is why the
 * panel says so rather than implying the numbers are fixed. Measurement history already exists per
 * garment and is linked from each card for the times the earlier figures are the question.</p>
 */
export function OrderMeasurements({
  customerId,
  items,
}: {
  customerId: string;
  items: OrderItem[];
}) {
  /**
   * The result and the customer it belongs to, held together.
   *
   * Two separate pieces of state, cleared at the top of the effect, was the obvious shape and had
   * two faults: clearing is a synchronous setState inside an effect, which cascades a render, and
   * between the customer changing and the new list arriving the panel would still be showing the
   * previous customer's figures under the new customer's name. Editing an order's customer is a
   * real action on this screen, so that window is reachable. Stamping the answer with whose it is
   * makes a stale result unusable rather than merely unlikely.
   */
  const [loaded, setLoaded] = useState<{
    customerId: string;
    list: Measurement[] | null;
  } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  /**
   * The shop's templates, for pairing a two-box point's figures onto one line.
   *
   * Cached shop-wide by the hook, so this costs nothing beyond the first screen that asks. A
   * template that has not arrived yet simply shows each stored key on its own row, which is the
   * display this panel had before pairs existed — never wrong, only less tidy for a moment.
   */
  const { templates } = useMeasurementTemplates();

  useEffect(() => {
    let cancelled = false;

    listMeasurementsForCustomer(customerId, getAccessToken())
      .then((list) => {
        if (!cancelled) {
          setLoaded({ customerId, list });
        }
      })
      .catch(() => {
        // Told rather than swallowed: a blank panel reads as "this customer has no measurements",
        // which is a different and much more alarming thing than "they could not be loaded".
        if (!cancelled) {
          setFailedFor(customerId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  // Anything stamped with a different customer is last customer's answer, and counts as not yet
  // arrived rather than as an answer about this one.
  const measurements = loaded?.customerId === customerId ? loaded.list : null;
  const failed = failedFor === customerId;

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Items &amp; Measurements</h2>
      </div>
      <p className="mb-4 text-xs text-foreground/60">
        The customer&apos;s current measurements. Re-measuring updates what is shown here, including on
        orders already placed.
      </p>

      {failed && (
        <p role="alert" className="text-sm text-danger">
          Measurements could not be loaded.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item, index) => {
          // Matched on the garment the row was written for. A shop renaming a garment after the
          // order was taken breaks the link, and the card says "none recorded" rather than
          // showing another garment's figures — wrong numbers are worse than no numbers here.
          const measurement = measurements?.find((m) => m.garmentType === item.garmentType);
          // Paired through the garment's template, so a point with two boxes reads as one line —
          // "Chest  40, 42" — rather than as two rows that happen to have similar names.
          const points = measurement
            ? toDisplayEntries(measurement.values, templates[item.garmentType] ?? [])
            : [];

          return (
            <div key={item.id} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-medium">
                  {index + 1}. {item.garmentType}
                  <span className="ml-2 font-normal text-foreground/60">× {item.quantity}</span>
                </span>
                {measurement && (
                  <Link
                    href={`/dashboard/measurements/${measurement.id}/history`}
                    className="text-xs font-medium text-primary hover:text-primary-hover"
                  >
                    History
                  </Link>
                )}
              </div>

              {measurements === null && !failed && <p className="text-sm text-foreground/50">Loading…</p>}

              {measurements !== null && !measurement && (
                <p className="text-sm text-foreground/50">No measurements recorded for this garment.</p>
              )}

              {points.length > 0 && (
                // A definition grid rather than a table: the pairs are short, and a table's header
                // row would repeat "Point / Value" above every garment on the order.
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  {points.map((entry) => (
                    <div key={entry.label} className="min-w-0">
                      <dt className="truncate text-xs text-foreground/60" title={entry.label}>
                        {entry.label}
                      </dt>
                      <dd className="text-sm font-medium tabular-nums">{entry.text}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {measurement?.notes && (
                <p className="mt-2 border-t border-border pt-2 text-sm text-foreground/70">
                  {measurement.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
