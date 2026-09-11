"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import { getBusinessMode } from "@/lib/api/business-mode";
import { isKindAvailable, orderKindMeta, type OrderKind } from "@/lib/orders/order-kind";
import { NewOrderForm } from "./NewOrderForm";

/**
 * One of the three New Order screens, with the shop's trade checked first.
 *
 * The three routes are otherwise identical — each names its kind and nothing else — so the check
 * lives here rather than being written out three times and corrected in two of them.
 *
 * A tailoring-only shop has no cloth to sell, so the two fabric screens are not merely hidden from
 * the chooser: reaching one by typed URL or an old bookmark lands back at the chooser rather than
 * on a form that would ask for a cloth code the shop has no answer for. The check is client-side
 * because this app is a static export with no server to do it — which makes it a guard against
 * confusion, not against a determined user. Nothing here is a permission: the API still decides
 * what may be created, and the shop's own mode is not a secret.
 */
export function OrderKindScreen({ kind }: { kind: OrderKind }) {
  const router = useRouter();
  // "checking" until the shop's mode has been read. The form is not rendered underneath in the
  // meantime — a fabric form that appears for half a second and then vanishes reads as a bug, and
  // on a slow connection it is long enough to have started typing into.
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">(() =>
    // A tailoring order needs no cloth, so it is available to every shop and there is nothing to
    // wait for. Skipping the fetch here is what keeps the common screen instant.
    orderKindMeta(kind).requiresFabricTrade ? "checking" : "allowed",
  );

  useEffect(() => {
    if (access !== "checking") {
      return;
    }

    let cancelled = false;
    // Never rejects — an unconfigured shop falls back to tailoring-only, which correctly denies the
    // fabric screens rather than failing open to them.
    getBusinessMode(getAccessToken()).then((mode) => {
      if (cancelled) {
        return;
      }
      if (isKindAvailable(kind, mode)) {
        setAccess("allowed");
        return;
      }
      setAccess("denied");
      // replace, not push: a shop that cannot use this screen should not be able to reach it again
      // with the back button.
      router.replace("/dashboard/orders/new");
    });

    return () => {
      cancelled = true;
    };
  }, [access, kind, router]);

  if (access !== "allowed") {
    return null;
  }

  return <NewOrderForm kind={kind} />;
}
