"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouteId } from "@/lib/use-route-id";
import { getPublicInvoice, type PublicInvoice } from "@/lib/api/public-invoice";

/** "25 Aug 2026" — spelled month, so no reader has to guess whether 08-09 is August or September. */
function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function money(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * The invoice a customer opens from WhatsApp.
 *
 * <p>Outside /dashboard on purpose: no sidebar, no login, no ERP chrome. The reader is not a member
 * of staff and has nowhere else in this application to go — everything here is read-only, and the
 * page asks for nothing.</p>
 *
 * <p>It reads one endpoint with a token and no credentials. There is no way from this page to any
 * other invoice: the token names exactly one, and the server tells a bad token from a good one only
 * by refusing it.</p>
 */
export default function PublicInvoicePageClient() {
  const shareToken = useRouteId();
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // The prerendered placeholder, before the real URL is known. Asking the server about "_" would
    // return a 404 and flash "not valid" at a customer whose link is perfectly good.
    if (!shareToken || shareToken === "_") {
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      setInvoice(await getPublicInvoice(shareToken));
    } catch {
      // One message for every failure. Which of them it was is not something a customer can act on,
      // and spelling out the difference would help somebody guessing at tokens.
      setLoadError("This invoice link is not valid. Please ask the shop for a new one.");
    } finally {
      setIsLoading(false);
    }
  }, [shareToken]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (isLoading || !invoice) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center p-6">
        <p className="text-sm text-foreground/70" role={loadError ? "alert" : undefined}>
          {loadError ?? "Loading your invoice…"}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5 sm:p-7 print:border-0 print:p-0">
        {/* The shop, then who and what — the order a bill is read in. */}
        <header className="flex flex-col gap-1 border-b border-border pb-4">
          <h1 className="text-xl font-semibold sm:text-2xl">{invoice.shopName}</h1>
          {invoice.shopAddress && (
            <p className="whitespace-pre-line text-sm text-foreground/70">{invoice.shopAddress}</p>
          )}
          {invoice.shopContactNumber && (
            <p className="text-sm text-foreground/70">Ph: {invoice.shopContactNumber}</p>
          )}
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Billed to</h2>
            <p className="text-sm font-medium">{invoice.customerName}</p>
            <p className="text-sm text-foreground/70 tabular-nums">{invoice.customerPhoneNumber}</p>
          </div>
          <div className="flex flex-col gap-1 sm:text-right">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Invoice</h2>
            <p className="text-sm font-medium">{invoice.invoiceNumber || "—"}</p>
            <p className="text-sm text-foreground/70">{formatDate(invoice.invoiceDateUtc)}</p>
          </div>
        </section>

        <section className="grid gap-4 rounded-md border border-border p-3 sm:grid-cols-2">
          <div className="flex items-baseline justify-between gap-3 sm:justify-start sm:gap-2">
            <span className="text-sm text-foreground/70">Order</span>
            <span className="text-sm font-medium">{invoice.orderNumber || "—"}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 sm:justify-end sm:gap-2">
            <span className="text-sm text-foreground/70">Collection date</span>
            <span className="text-sm font-medium">{formatDate(invoice.collectionDateUtc)}</span>
          </div>
        </section>

        {/* Garment, quantity, price, total. There is no separate fabric column: an order item
            stores one unit price with the cloth folded into it, so a fabric figure here would be
            invented rather than reported. */}
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-foreground/70">
                  <th className="py-2 font-medium">Garment</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Rate</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={`${item.garmentType}-${index}`} className="border-b border-border/60 last:border-0">
                    <td className="py-2">{item.garmentType}</td>
                    <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-2 text-right tabular-nums">{money(item.unitPrice)}</td>
                    <td className="py-2 text-right tabular-nums">{money(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-1.5 border-t border-border pt-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-foreground/70">Subtotal</span>
            <span className="tabular-nums">{money(invoice.subtotal)}</span>
          </div>
          {invoice.discountAmount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-foreground/70">Discount</span>
              <span className="tabular-nums">−{money(invoice.discountAmount)}</span>
            </div>
          )}
          {invoice.taxAmount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-foreground/70">Tax</span>
              <span className="tabular-nums">{money(invoice.taxAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-semibold">Order Total</span>
            <span className="text-base font-semibold tabular-nums text-primary">{money(invoice.totalAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground/70">Advance Paid</span>
            <span className="tabular-nums">{money(invoice.amountPaid)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-semibold">Balance Due</span>
            <span className="text-base font-semibold tabular-nums text-primary">{money(invoice.remainingBalance)}</span>
          </div>
        </section>
      </div>

      {/* The browser's own print dialog, which saves to PDF on every platform the shop's customers
          use. No PDF is generated or stored server-side for this page — there is nothing here the
          browser cannot already produce, and a stored file would be a second copy to keep in step. */}
      <div className="flex justify-center print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Download / Print invoice
        </button>
      </div>
    </main>
  );
}
