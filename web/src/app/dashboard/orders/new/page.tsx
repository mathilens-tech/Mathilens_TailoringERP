"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import { getBusinessMode, type BusinessMode } from "@/lib/api/business-mode";
import { availableKinds } from "@/lib/orders/order-kind";

/**
 * What kind of order is this?
 *
 * The question used to be answered in two places at once — a Stitching / Fabric only toggle in the
 * title row for whether anything was being made, and a Shop / Customer fabric choice on each item
 * row for whose cloth it was — so the three real answers were never named and staff worked out
 * which they were writing from whichever fields happened to appear. Asking once, up front, in the
 * shop's own words, is the whole point of this screen.
 *
 * A shop that does not sell cloth has only one possible answer, so it is not asked: it goes
 * straight to the tailoring screen. A question with one option is not a question.
 */
export default function NewOrderKindChooserPage() {
  const router = useRouter();
  const [mode, setMode] = useState<BusinessMode | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Never rejects — an unconfigured shop falls back to tailoring-only.
    getBusinessMode(getAccessToken()).then((saved) => {
      if (cancelled) {
        return;
      }
      const kinds = availableKinds(saved);
      if (kinds.length === 1) {
        // replace, not push: this page has nothing to come back to.
        router.replace(`/dashboard/orders/new/${kinds[0].slug}`);
        return;
      }
      setMode(saved);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Nothing while the mode is being read. A tailoring-only shop is on its way to the tailoring
  // screen, and flashing three cards at it first would offer two it can never use.
  if (mode === null) {
    return null;
  }

  const kinds = availableKinds(mode);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">New Order</h1>
          <p className="mt-0.5 text-sm text-foreground/70">What kind of order is this?</p>
        </div>
        <Link href="/dashboard/orders" className="text-sm font-medium text-primary hover:text-primary-hover">
          Back to orders
        </Link>
      </div>

      {/* Cards rather than a dropdown: this is three choices seen at once and compared, not a value
          being set. Each says whose cloth it is, because that — not the garment, not the price — is
          the only thing that separates them. */}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kinds.map((meta) => (
          <li key={meta.kind}>
            <Link
              href={`/dashboard/orders/new/${meta.slug}`}
              className="flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary hover:bg-surface-hover focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <span className="text-lg font-semibold text-foreground">{meta.label}</span>
              <span className="text-sm text-foreground/70">{meta.description}</span>
              <span className="mt-auto pt-2 text-sm font-medium text-primary">{meta.fabricNote}</span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Said plainly rather than left to be discovered: a shop wondering where the fabric screens
          went is looking at the wrong page for the answer. */}
      <p className="text-sm text-foreground/60">
        Selling cloth as well as stitching?{" "}
        <Link href="/dashboard/settings/business-mode" className="text-primary hover:text-primary-hover">
          Settings › Business Mode
        </Link>{" "}
        decides which of these are offered.
      </p>
    </div>
  );
}
