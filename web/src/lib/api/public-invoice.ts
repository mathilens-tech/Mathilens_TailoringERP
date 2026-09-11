import { apiGet } from "@/lib/api-client";

/**
 * An invoice as a customer sees it, fetched with a share token and no credentials.
 *
 * Mirrors PublicInvoiceDto on the server, which is a deliberately narrower shape than the invoice
 * the shop works with: no identifiers, no audit columns, no internal status. What is here is what
 * is printed on a bill and handed over anyway.
 */
export type PublicInvoice = {
  shopName: string;
  shopAddress: string | null;
  shopContactNumber: string | null;
  customerName: string;
  customerPhoneNumber: string;
  invoiceNumber: string;
  invoiceDateUtc: string;
  orderNumber: string;
  collectionDateUtc: string;
  items: PublicInvoiceItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  remainingBalance: number;
};

export type PublicInvoiceItem = {
  garmentType: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

/**
 * No token argument for the caller to forget: this endpoint is anonymous by design, and passing an
 * access token to it would attach the shop's credentials to a page a customer opens.
 */
export function getPublicInvoice(shareToken: string) {
  return apiGet<PublicInvoice>(`/api/v1/public/invoices/${encodeURIComponent(shareToken)}`, null);
}
