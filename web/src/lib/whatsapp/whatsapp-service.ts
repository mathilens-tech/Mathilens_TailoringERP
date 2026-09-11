import { normalizePhoneNumber } from "@/lib/contact";
import { manualWhatsAppProvider, type WhatsAppDelivery } from "@/lib/whatsapp/provider";

/**
 * Everything the shop needs to hand a customer their invoice over WhatsApp, in one place.
 *
 * Split three ways on purpose — the number, the words, and the delivery are three separate
 * problems, and only the third one changes when a Business API is added:
 *
 *   toWhatsAppNumber()     what to dial
 *   buildInvoiceMessage()  what to say
 *   shareInvoice()         how it gets there  <- the only provider-aware step
 *
 * No component builds a wa.me URL of its own. Four screens share this, and four hand-rolled URLs
 * would be four chances for one of them to forget to encode the message or to prepend 91 twice.
 */

/**
 * What the shop is, as the message signs itself off.
 *
 * Passed in rather than read here: this file has no business fetching settings, and the caller
 * already has the branding it needs for the page it is on.
 */
export type ShopIdentity = {
  name: string;
};

/** The order and invoice facts the message quotes. All of them come from saved records. */
export type InvoiceShare = {
  customerName: string;
  /** As stored — normalization happens here, so callers pass whatever the record holds. */
  customerPhoneNumber: string;
  orderNumber: string;
  invoiceNumber: string;
  orderTotal: number;
  advancePaid: number;
  balanceDue: number;
  /** The order's collection date, ISO or anything Date can read. */
  collectionDateUtc: string;
};

/**
 * Which message a share sends.
 *
 * Three, because an order is shared with a customer at three different moments and they are not the
 * same news. The invoice one goes out when the order is taken; the other two follow the order's own
 * status, so what the customer is told and what the shop's screen says can never disagree.
 */
export type ShareKind = "invoice" | "ready" | "delivered";

/**
 * What a status message quotes. Less than an invoice share needs, deliberately: telling somebody
 * their clothes are ready does not depend on an invoice existing.
 */
export type StatusShare = {
  customerName: string;
  orderNumber: string;
  /**
   * What is still owed, or null to say nothing about money at all — no invoice raised, or nothing
   * left to pay. A line reading "Balance Due: ₹0.00" invites a question that has no answer.
   */
  balanceDue: number | null;
  /** The order's collection date, ISO or anything Date can read. */
  collectionDateUtc: string;
};

/** Why a share cannot go ahead, in words a person at the counter can act on. */
export type ShareBlockedReason =
  | "no-customer"
  | "no-phone-number"
  | "invalid-phone-number"
  | "no-invoice";

export const SHARE_BLOCKED_MESSAGES: Record<ShareBlockedReason, string> = {
  "no-customer": "Select a customer before sharing this on WhatsApp.",
  "no-phone-number":
    "WhatsApp number is not available for this customer. Please update the customer details.",
  "invalid-phone-number":
    "This customer's phone number is not a valid WhatsApp number. Please update the customer details.",
  "no-invoice": "Generate the invoice before sharing it via WhatsApp.",
};

/**
 * The digits wa.me wants: country code and national number, run together, nothing else.
 *
 * Built on the app's existing `normalizePhoneNumber`, which already knows that ten digits is a bare
 * national number, that twelve beginning 91 already carries the country code, and that eleven
 * beginning 0 carries the old trunk prefix. So "9876543210", "+919876543210", "91 98765 43210" and
 * "+91-98765-43210" all arrive as 919876543210, and the country code is never applied twice.
 *
 * Returns null for anything that is not a number this shop can message, rather than a best guess —
 * a wrong number that looks right is how an invoice reaches a stranger.
 */
export function toWhatsAppNumber(rawPhoneNumber: string | null | undefined): string | null {
  if (!rawPhoneNumber) {
    return null;
  }

  const canonical = normalizePhoneNumber(rawPhoneNumber);
  if (canonical === null) {
    return null;
  }

  // "+919876543210" -> "919876543210". wa.me rejects the plus, and the separators are already gone.
  return canonical.replace(/\D/g, "");
}

/** "25-Aug-2026" — unambiguous to a reader in any locale, unlike 08/09/2026. */
function formatCollectionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(date.getDate()).padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

/** Indian digit grouping, since this is money a customer in India is being asked for. */
function money(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * The message, from the order and invoice as saved.
 *
 * Nothing here is hardcoded: every name, number, amount and date is an argument, and the shop's own
 * name comes from Settings › Branding rather than from this file — a shop renaming itself should
 * not be a code change.
 *
 * Single asterisks, not double: *this* is what WhatsApp renders as bold, and **this** would arrive
 * with the asterisks still in it. They show as asterisks in the preview textarea, which is the
 * honest thing to show — that box holds the exact string being handed over, not a rendering of it.
 *
 * No invoice link. The read-only invoice page and its share token still exist and still work; this
 * message simply carries no URL, which is also what stops a localhost address reaching a customer
 * when someone shares from a dev machine.
 */
export function buildInvoiceMessage(share: InvoiceShare, shop: ShopIdentity): string {
  const lines: string[] = [
    `Hi ${share.customerName} 👋`,
    "",
    `Thank you for choosing *${shop.name}*.`,
    "",
    "Your order has been *received successfully*.",
    "",
    `📦 *Order:* ${share.orderNumber}`,
    "",
    `💰 *Order Total:* ${money(share.orderTotal)}`,
    `💳 *Balance Due:* ${money(share.balanceDue)}`,
  ];

  // Dropped rather than printed empty: a collection date nobody set should not arrive as a
  // heading with nothing after it.
  const collectionDate = formatCollectionDate(share.collectionDateUtc);
  if (collectionDate !== "") {
    lines.push(`📅 *Collection Date:* ${collectionDate}`);
  }

  lines.push("", "Thank you,", `*${shop.name}*`);

  return lines.join("\n");
}

/**
 * "Your order is ready" — sent once the order reaches Ready For Delivery.
 *
 * The one message in this file the customer is expected to act on, so it ends by asking for the
 * thing the shop actually wants: come and collect it. The balance is named rather than left as a
 * surprise at the counter — somebody who knows what to bring brings it.
 */
export function buildReadyMessage(share: StatusShare, shop: ShopIdentity): string {
  const lines: string[] = [
    `Hi ${share.customerName} 👋`,
    "",
    `Your order from *${shop.name}* is *ready for collection*.`,
    "",
    `📦 *Order:* ${share.orderNumber}`,
  ];

  // Both dropped rather than printed empty, same as the invoice message: a heading with nothing
  // after it reads as a fault in the shop's system.
  if (share.balanceDue !== null && share.balanceDue > 0) {
    lines.push(`💳 *Balance Due:* ${money(share.balanceDue)}`);
  }

  const collectionDate = formatCollectionDate(share.collectionDateUtc);
  if (collectionDate !== "") {
    lines.push(`📅 *Collection Date:* ${collectionDate}`);
  }

  lines.push("", "Please collect at your convenience.", "", "Thank you,", `*${shop.name}*`);

  return lines.join("\n");
}

/**
 * "Your order has been delivered" — the thank-you, sent once it is handed over.
 *
 * Says nothing about money, and not by omission: this shop blocks delivery while payment is
 * pending, so by the time an order is Delivered there is nothing left to ask for. A balance line
 * here would either read ₹0.00 or contradict the rule that let the order be delivered at all.
 */
export function buildDeliveredMessage(share: StatusShare, shop: ShopIdentity): string {
  return [
    `Hi ${share.customerName} 👋`,
    "",
    `Your order *${share.orderNumber}* has been *delivered*.`,
    "",
    `Thank you for choosing *${shop.name}*. We hope to see you again 🙏`,
    "",
    `*${shop.name}*`,
  ].join("\n");
}

/**
 * Hand the message over, whichever provider is configured.
 *
 * The message is passed in rather than built here so the preview dialog can show it, let it be
 * edited, and send exactly what was on screen — the thing shown and the thing sent are the same
 * string, not two renderings that could drift.
 */
export async function shareInvoice(
  phoneNumber: string,
  message: string,
  provider: WhatsAppDelivery = manualWhatsAppProvider,
): Promise<void> {
  await provider.deliver(phoneNumber, message);
}

/**
 * The read-only invoice page for a share token, on this deployment's own origin.
 *
 * Built from the browser's own origin rather than a configured base URL: the app is a static export
 * served from wherever it was deployed, and the origin the staff member is looking at is by
 * definition one that resolves. A hardcoded domain would put localhost into a customer's message
 * the first time anyone shared from a dev machine.
 */
export function buildInvoiceUrl(token: string): string {
  return `${window.location.origin}/invoice/view/${token}`;
}
