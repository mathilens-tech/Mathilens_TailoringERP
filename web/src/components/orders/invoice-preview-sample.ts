import { taxAmountFor } from "@/lib/api/invoice-settings";
import type { Invoice } from "@/lib/api/billing";
import type { Order } from "@/lib/api/orders";
import type { Customer } from "@/lib/api/customers";

/**
 * A made-up order to show settings against, so the Invoice Settings screen can render the real
 * invoice rather than describe it.
 *
 * <p>Chosen to exercise every part of the document: two lines so the item table has something to
 * rule, and an advance so Payment Summary shows a status other than UNPAID. Nothing here is
 * written anywhere — it exists for the length of a render.</p>
 */

const SAMPLE_ADVANCE = 500;
const DAYS_UNTIL_COLLECTION = 5;

const SAMPLE_ITEMS = [
  { garmentType: "Shirt" as const, quantity: 2, unitPrice: 350 },
  { garmentType: "Pant" as const, quantity: 1, unitPrice: 300 },
];

const SAMPLE_SUBTOTAL = SAMPLE_ITEMS.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

export type InvoicePreview = { invoice: Invoice; order: Order; customer: Customer };

/**
 * @param nowIso Read once on the client rather than during render — a date baked into the server's
 *   HTML and re-derived on the client is the classic hydration mismatch.
 */
export function buildInvoicePreview(nowIso: string, taxRatePercent: number, numberPrefix: string): InvoicePreview {
  const dueAtUtc = new Date(new Date(nowIso).getTime() + DAYS_UNTIL_COLLECTION * 86_400_000).toISOString();

  const taxAmount = taxAmountFor(SAMPLE_SUBTOTAL, taxRatePercent);
  const totalAmount = SAMPLE_SUBTOTAL + taxAmount;

  const customer: Customer = {
    id: "5a1e0000-0000-0000-0000-000000000000",
    fullName: "Nandha Kumar",
    phoneNumber: "82200 70369",
    email: null,
    address: null,
    notes: null,
    gender: null,
    religion: null,
    dateOfBirth: null,
    weddingDate: null,
    createdAtUtc: nowIso,
  };

  const order: Order = {
    id: "7c2b0000-0000-0000-0000-000000000000",
    orderNumber: "MTL-0007",
    customerId: customer.id,
    employeeId: null,
    status: "Received",
    dueAtUtc,
    deliveredAtUtc: null,
    notes: null,
    createdAtUtc: nowIso,
    totalAmount: SAMPLE_SUBTOTAL,
    amountPaid: SAMPLE_ADVANCE,
    balanceAmount: SAMPLE_SUBTOTAL - SAMPLE_ADVANCE,
    items: SAMPLE_ITEMS.map((item, index) => ({
      id: `item-${index}`,
      garmentType: item.garmentType,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      fabric: null,
    })),
  };

  const invoice: Invoice = {
    id: "93563890-0000-0000-0000-000000000000",
    // Shown as the seventh invoice of the current year, so the preview reflects the code being
    // typed. The real number is issued by the server when the invoice is raised.
    invoiceNumber: `${numberPrefix.trim().toUpperCase() || "INV"}-${new Date(nowIso).getFullYear()}-0007`,
    orderId: order.id,
    customerId: customer.id,
    subtotal: SAMPLE_SUBTOTAL,
    taxAmount,
    discountAmount: 0,
    totalAmount,
    amountPaid: SAMPLE_ADVANCE,
    remainingBalance: totalAmount - SAMPLE_ADVANCE,
    status: "PartiallyPaid",
    createdAtUtc: nowIso,
    payments: [{ id: "payment-0", amount: SAMPLE_ADVANCE, method: "Cash", createdAtUtc: nowIso }],
  };

  return { invoice, order, customer };
}
