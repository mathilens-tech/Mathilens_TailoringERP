import { apiGet, apiGetPaged, apiPost, apiPostNoContent } from "@/lib/api-client";

export const INVOICE_STATUSES = ["Unpaid", "PartiallyPaid", "Paid", "Void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ["Cash", "Card", "Upi", "BankTransfer", "Other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * What each method is called, as opposed to what the enum spells it.
 *
 * <p>"Upi" and "BankTransfer" are C# identifiers, and screens that printed the value straight
 * through showed them to staff that way. One map, so a payment reads the same on the invoice page,
 * in the method picker and in the delivery dialog.</p>
 */
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Cash: "Cash",
  Card: "Card",
  Upi: "UPI",
  BankTransfer: "Bank Transfer",
  Other: "Other",
};

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

export type Payment = {
  id: string;
  amount: number;
  method: PaymentMethod;
  createdAtUtc: string;
};

export type Invoice = {
  id: string;
  /** The shop's own reference — "INV-2026-0001". Empty only on an invoice raised before numbering existed. */
  invoiceNumber: string;
  orderId: string;
  customerId: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  remainingBalance: number;
  status: InvoiceStatus;
  createdAtUtc: string;
  payments: Payment[];
};

/** A half-open [from, to) range of UTC instants. Either end may be null for "unbounded". */
export type DateRange = { fromUtc: string | null; toUtc: string | null };

export function searchInvoices(
  customerId: string | null,
  status: InvoiceStatus | null,
  page: number,
  pageSize: number,
  token: string | null,
  range: DateRange = { fromUtc: null, toUtc: null },
) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (customerId) {
    params.set("customerId", customerId);
  }
  if (status) {
    params.set("status", status);
  }
  if (range.fromUtc) {
    params.set("from", range.fromUtc);
  }
  if (range.toUtc) {
    params.set("to", range.toUtc);
  }
  return apiGetPaged<Invoice>(`/api/v1/invoices?${params}`, token);
}

export function getInvoice(id: string, token: string | null) {
  return apiGet<Invoice>(`/api/v1/invoices/${id}`, token);
}

export function createInvoice(orderId: string, taxAmount: number, discountAmount: number, token: string | null) {
  return apiPost<Invoice>("/api/v1/invoices", { orderId, taxAmount, discountAmount }, token);
}

export function recordPayment(invoiceId: string, amount: number, method: PaymentMethod, token: string | null) {
  return apiPost<Invoice>(`/api/v1/invoices/${invoiceId}/payments`, { amount, method }, token);
}

export function voidInvoice(invoiceId: string, token: string | null): Promise<void> {
  return apiPostNoContent(`/api/v1/invoices/${invoiceId}/void`, {}, token);
}

/**
 * The opaque half of the read-only link a customer is sent.
 *
 * The server holds the key and hands back a token only — the link itself is assembled in the
 * browser from this deployment's own origin, since the API has no reliable idea which host the
 * staff member reached the app on.
 */
export function getInvoiceShareToken(invoiceId: string, token: string | null) {
  return apiGet<{ token: string }>(`/api/v1/invoices/${invoiceId}/share-token`, token);
}
