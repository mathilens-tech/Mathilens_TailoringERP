import { searchInvoices, type Invoice } from "./billing";
import { taxAmountFor } from "./invoice-settings";
import type { Order } from "./orders";

/** The largest page the API will accept — PaginationDefaults.MaxPageSize. Asking for more is a 400. */
const INVOICE_SCAN_PAGE_SIZE = 100;
const INVOICE_SCAN_MAX_PAGES = 5;

/**
 * The invoices already raised against an order.
 *
 * <p>The invoice search filters by customer, not by order, so this reads that customer's invoices
 * and keeps the ones pointing here. An orderId filter would be the cleaner answer and belongs on
 * the API — until then this is what can be done from the browser, and for a customer with a single
 * page of invoices (nearly all of them) it costs one request.</p>
 *
 * <p>Capped rather than looped to exhaustion: a customer past this many invoices would be a decade
 * of orders, and an unbounded scan on a screen someone is standing at waiting for is the worse
 * failure.</p>
 *
 * <p>Lives here rather than on either screen because two of them need it — the order page, which
 * runs it on load, and the Orders list, which runs it when someone asks to take a payment. A second
 * copy of a paging loop is a second place for the page cap to be got wrong.</p>
 */
export async function findInvoicesForOrder(
  orderId: string,
  customerId: string,
  token: string | null,
): Promise<Invoice[]> {
  const found: Invoice[] = [];

  for (let page = 1; page <= INVOICE_SCAN_MAX_PAGES; page += 1) {
    const { items, meta } = await searchInvoices(customerId, null, page, INVOICE_SCAN_PAGE_SIZE, token);
    found.push(...items.filter((invoice) => invoice.orderId === orderId));

    if (page >= meta.totalPages) {
      break;
    }
  }

  return found;
}

/**
 * The invoice an order currently stands on, or null.
 *
 * <p>Voided ones are skipped rather than returned as the order's invoice — a voided invoice is a
 * withdrawn one, and the order needs a new one raised. Newest first, because nothing stops a second
 * invoice being issued against the same order.</p>
 */
export function activeInvoiceOf(invoices: Invoice[]): Invoice | null {
  return (
    invoices
      .filter((invoice) => invoice.status !== "Void")
      .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc))[0] ?? null
  );
}

/**
 * The invoice to take money against, or null when nothing is owed on any of them.
 *
 * <p>Deliberately not <see cref="activeInvoiceOf"/>. Newest-first is right for showing an order's
 * invoice, but wrong for collecting: order RT-0006 carries two live invoices, and the newer one is
 * settled in full while the older still has 290 outstanding. Newest-first would hand the counter
 * the paid one and the debt would never be visible.</p>
 *
 * <p>Oldest first among those still owing, so a customer with two open invoices clears the one they
 * have had longest.</p>
 */
export function payableInvoiceOf(invoices: Invoice[]): Invoice | null {
  return (
    invoices
      .filter((invoice) => invoice.status !== "Void" && invoice.remainingBalance > 0)
      .sort((a, b) => a.createdAtUtc.localeCompare(b.createdAtUtc))[0] ?? null
  );
}

export type DeliveryFacts = {
  /** The invoice a delivery payment settles, or null when one has to be raised first. */
  payable: Invoice | null;
  /** Confirming the delivery will raise an invoice, because the order has never had one. */
  willRaiseInvoice: boolean;
  /** The garments, before tax — the invoice's subtotal once one exists. */
  orderTotal: number;
  taxAmount: number;
  invoiceTotal: number;
  /** Collected already, whether at the counter when the order was taken or since. */
  advancePaid: number;
  /** What must be collected before the order can be handed over. */
  outstanding: number;
};

/**
 * What a delivery has to deal with, money-wise.
 *
 * <p>Three situations, and telling them apart is the whole job. An invoice with money owing is the
 * ordinary one. Every invoice settled means there is nothing to collect. No invoice at all is the
 * awkward one — the order still owes its own value, but there is nothing to record a payment
 * against, so confirming has to raise one.</p>
 *
 * <p>That third case is not hypothetical: order RT-0003 reached Ready for Delivery having never
 * been invoiced, and the delivery dialog read "Nothing outstanding" above a row saying 130.00 was
 * owed. The server would have allowed it — it refuses delivery on an unpaid <em>invoice</em>, and
 * an order without one owes nothing by that measure — so the garment would have gone out with the
 * money uncollected and nothing ever billed.</p>
 *
 * <p>Shared by the Orders list and the order page so the two cannot disagree about what an order
 * owes on its way out the door.</p>
 */
export function deliveryFactsFor(order: Order | null, invoices: Invoice[], taxRatePercent: number): DeliveryFacts {
  // An invoice with money owing answers every figure itself, and its numbers are the ones actually
  // charged — including whatever tax the rate happened to be on the day it was raised.
  const payable = payableInvoiceOf(invoices);
  if (payable) {
    return {
      payable,
      willRaiseInvoice: false,
      orderTotal: payable.subtotal,
      taxAmount: payable.taxAmount,
      invoiceTotal: payable.totalAmount,
      advancePaid: payable.amountPaid,
      outstanding: payable.remainingBalance,
    };
  }

  // Void ones don't count as having been invoiced — a withdrawn invoice leaves the order needing a
  // new one, which is exactly the case being handled here.
  const settled = activeInvoiceOf(invoices);
  if (settled) {
    return {
      payable: null,
      willRaiseInvoice: false,
      orderTotal: settled.subtotal,
      taxAmount: settled.taxAmount,
      invoiceTotal: settled.totalAmount,
      advancePaid: settled.amountPaid,
      outstanding: 0,
    };
  }

  // Never invoiced. The order's own value is what is owed, plus the tax the invoice raised on
  // confirmation will carry — quoting the order's figure alone would collect 130.00 against a
  // 131.30 invoice and leave the delivery refused over the 1.30.
  const orderTotal = order?.totalAmount ?? 0;
  const taxAmount = taxAmountFor(orderTotal, taxRatePercent);

  return {
    payable: null,
    willRaiseInvoice: orderTotal > 0,
    orderTotal,
    taxAmount,
    invoiceTotal: orderTotal + taxAmount,
    advancePaid: 0,
    outstanding: orderTotal + taxAmount,
  };
}
