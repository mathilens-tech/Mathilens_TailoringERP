"use client";

import { useEffect } from "react";
import { InvoiceDocument } from "./InvoiceDocument";
import type { Invoice } from "@/lib/api/billing";
import type { Order } from "@/lib/api/orders";
import type { Customer } from "@/lib/api/customers";

type InvoicePrintModalProps = {
  invoice: Invoice;
  order: Order;
  customer: Customer;
  onClose: () => void;
  /** Opens straight into the print dialog (for the "Print Invoice" button) instead of waiting for
   * the on-screen Print button (for "View Invoice"). */
  autoPrint?: boolean;
};

/** The printable invoice as a modal rather than a page navigation, so staff can print and keep
 * working on the same order. The slip itself is {@link InvoiceDocument} — this adds only the
 * chrome around it, all of which is hidden when printing. */
export function InvoicePrintModal({ invoice, order, customer, onClose, autoPrint = false }: InvoicePrintModalProps) {
  useEffect(() => {
    // Mount-only: this component is conditionally rendered (unmounted on Close), so every open
    // is a fresh mount and this fires exactly once per "Print Invoice" click.
    if (autoPrint) {
      window.print();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 print:static print:inset-auto print:z-auto print:block print:bg-transparent print:p-0"
      role="dialog"
      aria-modal="true"
    >
      {/* Slip-width. The bill is a till receipt, so the modal is only as wide as the roll it prints
          on — a wide dialog around a narrow slip just puts it adrift in the middle. */}
      <div className="flex max-h-[92dvh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-surface p-4 sm:p-6 print:max-h-none print:w-auto print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:p-0">
        <div className="flex items-center justify-between print:hidden">
          <h2 className="text-lg font-semibold">Invoice</h2>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => window.print()} className="text-sm text-foreground/70 hover:text-foreground">
              Print
            </button>
            <button type="button" onClick={onClose} className="text-sm text-foreground/70 hover:text-foreground">
              Close
            </button>
          </div>
        </div>

        <InvoiceDocument invoice={invoice} order={order} customer={customer} />
      </div>
    </div>
  );
}
