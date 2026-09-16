import { getSetting, upsertSetting } from "@/lib/api/settings";

/**
 * The two messages the shop writes for itself, rather than the ones this app writes for it.
 *
 * `buildInvoiceMessage` and the two status messages beside it stay exactly as they were: those go
 * out on a fixed occasion, quote figures that must be right, and a shop editing them into something
 * that omits the balance is a support call. These two are different — they are the drafts that open
 * when somebody presses the WhatsApp icon with no particular event behind it, and what a shop wants
 * to say to a customer out of the blue is not something this file can know.
 *
 * Stored as ordinary settings, so there is no schema, no migration and no endpoint: the key/value
 * store already carries the shop name, the order prefix and the business mode.
 */

export const CUSTOMER_MESSAGE_TEMPLATE_KEY = "WhatsApp.Template.Customer";
export const ORDER_MESSAGE_TEMPLATE_KEY = "WhatsApp.Template.Order";

/**
 * What a template may refer to, and what each stands for on the screen that offers it.
 *
 * Deliberately small. Every one of these is a fact the calling screen already holds about the
 * record in front of it — nothing here requires a lookup, so a template can never be the reason a
 * message is slow to draft or fails to draft at all.
 */
export type TemplateField = {
  token: string;
  /** What to call it where the shop is choosing one to insert. */
  label: string;
};

/** Available in both templates: the person being written to, and who is writing. */
export const COMMON_FIELDS: readonly TemplateField[] = [
  { token: "{customerName}", label: "Customer name" },
  { token: "{shopName}", label: "Shop name" },
];

/** The order screen knows all of this as well, because it is looking at the order. */
export const ORDER_FIELDS: readonly TemplateField[] = [
  ...COMMON_FIELDS,
  { token: "{orderNumber}", label: "Order number" },
  { token: "{orderTotal}", label: "Order total" },
  { token: "{balanceDue}", label: "Balance due" },
  { token: "{collectionDate}", label: "Collection date" },
];

/**
 * What the icon drafts before anybody has configured anything.
 *
 * A greeting and a sign-off and nothing in between, on purpose: this is the message a shop sends to
 * announce an offer, and any specific offer written here would be one this shop is not running.
 * Leaving the middle empty is what makes it obvious the text is meant to be replaced, where a
 * plausible-looking placeholder offer would get sent as-is by somebody in a hurry.
 */
export const DEFAULT_CUSTOMER_TEMPLATE = [
  "Hi {customerName} 👋",
  "",
  "",
  "",
  "Thank you,",
  "*{shopName}*",
].join("\n");

/** The order-screen draft. Quotes the order rather than the invoice, which may not exist yet. */
export const DEFAULT_ORDER_TEMPLATE = [
  "Hi {customerName} 👋",
  "",
  "Regarding your order *{orderNumber}* with *{shopName}*.",
  "",
  "📅 *Collection Date:* {collectionDate}",
  "💳 *Balance Due:* {balanceDue}",
  "",
  "Thank you,",
  "*{shopName}*",
].join("\n");

/**
 * Substitutes every token the caller supplied, and leaves the rest alone.
 *
 * Left alone rather than blanked, deliberately. A template written against a field the calling
 * screen does not have — {orderNumber} in the customer message — arrives with the token still
 * visible, which is ugly and instantly diagnosable. Blanking it would produce "Regarding your order
 * with" and read as a bug in the shop's own words rather than a template referring to something
 * that is not there.
 *
 * A plain loop over the supplied values, not a regex over the template: the replacement text comes
 * from customer records, so a name containing a $ must not be read as a capture reference, and a
 * shop name containing braces must not be re-scanned as a token of its own.
 */
export function renderTemplate(template: string, values: Record<string, string>): string {
  let rendered = template;
  for (const [token, value] of Object.entries(values)) {
    rendered = rendered.split(token).join(value);
  }
  return rendered;
}

/**
 * The shop's text, or the default when it has never set one.
 *
 * Never rejects, and treats blank as unset: a template saved empty would otherwise hand WhatsApp an
 * empty message, and the screen offering the button has no way to recover from that at the moment
 * it is pressed.
 */
async function loadTemplate(key: string, fallback: string, token: string | null): Promise<string> {
  try {
    const setting = await getSetting(key, token);
    return setting.value.trim() === "" ? fallback : setting.value;
  } catch {
    return fallback;
  }
}

export function getCustomerMessageTemplate(token: string | null): Promise<string> {
  return loadTemplate(CUSTOMER_MESSAGE_TEMPLATE_KEY, DEFAULT_CUSTOMER_TEMPLATE, token);
}

export function getOrderMessageTemplate(token: string | null): Promise<string> {
  return loadTemplate(ORDER_MESSAGE_TEMPLATE_KEY, DEFAULT_ORDER_TEMPLATE, token);
}

export async function saveCustomerMessageTemplate(value: string, token: string | null): Promise<void> {
  await upsertSetting(CUSTOMER_MESSAGE_TEMPLATE_KEY, value, token);
}

export async function saveOrderMessageTemplate(value: string, token: string | null): Promise<void> {
  await upsertSetting(ORDER_MESSAGE_TEMPLATE_KEY, value, token);
}
