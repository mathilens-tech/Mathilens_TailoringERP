"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import {
  loadOrderEntrySettings,
  subscribeToOrderEntrySettings,
  DEFAULT_ORDER_ENTRY_SETTINGS,
  type OrderEntrySettings,
} from "@/lib/api/order-entry-settings";

/**
 * What the entry pads offer, shared across every field that asks.
 *
 * <p>The same shape as {@link useMeasurementTemplates} and for the same reason: a measurement panel
 * can hold thirty fields, and each one needs this. Reading it per field would be thirty requests to
 * answer one question, so the module caches the answer and hands every caller the same one.</p>
 *
 * <p>Starts on the defaults rather than on nothing, so a pad is never briefly missing while the
 * read is in flight — a field that cannot be answered for a second is worse than one answered from
 * a sensible default and corrected a moment later.</p>
 */
export function useOrderEntrySettings(): OrderEntrySettings {
  const [settings, setSettings] = useState<OrderEntrySettings>(DEFAULT_ORDER_ENTRY_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    // Refetched here, with this screen's token, rather than handed a value from the module. There
    // is no token at module scope, and fetching without one silently yields the defaults.
    const read = () =>
      loadOrderEntrySettings(getAccessToken()).then((loaded) => {
        if (!cancelled) {
          setSettings(loaded);
        }
      });

    const unsubscribe = subscribeToOrderEntrySettings(read);
    void read();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return settings;
}
