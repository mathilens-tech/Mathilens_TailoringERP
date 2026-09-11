import { listSettings, upsertSetting, SHOP_NAME_KEY, SHOP_CONTACT_NUMBER_KEY } from "./settings";
import { SHOP_ADDRESS_KEY, SHOP_TAGLINE_KEY, BRANDING_LOGO_URL_KEY } from "./branding";

/**
 * The letterhead keys are the same three Branding writes, deliberately: a shop that changes its
 * phone number on one screen has changed it on the other, because there is only ever one stored
 * value. Two screens, one setting.
 */
export const INVOICE_NUMBER_PREFIX_KEY = "Invoice.NumberPrefix";
export const INVOICE_FOOTER_NOTE_KEY = "Invoice.FooterNote";
/** A percentage, stored as a plain number string — "5" means 5% of the order's own total. */
export const INVOICE_TAX_RATE_KEY = "Invoice.TaxRatePercent";

export const DEFAULT_NUMBER_PREFIX = "INV";

/** Printed when the shop hasn't set its own name. Shared, so no screen can hard-code a different one. */
export const DEFAULT_SHOP_NAME = "Mathilens Tailoring";

export type InvoiceSettings = {
  companyName: string;
  address: string;
  phoneNumber: string;
  numberPrefix: string;
  /** Blank on most invoices — a shop that wants a closing line sets it in Settings > Advanced. */
  footerNote: string;
  taxRatePercent: number;
  /** Read for the letterhead, edited on the Branding screen — this screen never writes them. */
  tagline: string;
  logoUrl: string;
};

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  companyName: "",
  address: "",
  phoneNumber: "",
  numberPrefix: DEFAULT_NUMBER_PREFIX,
  footerNote: "",
  taxRatePercent: 0,
  tagline: "",
  logoUrl: "",
};

/** As many settings as the API will return in one page — there are a couple of dozen in total. */
const SETTINGS_PAGE_SIZE = 100;
const SETTINGS_MAX_PAGES = 5;

/**
 * Everything the shop decides about its invoices.
 *
 * <p>Read as one listing rather than a request per key. Eleven parallel lookups for one letterhead
 * was a lot of ways for a printed invoice to end up wearing the wrong shop's name, and every one of
 * them failed silently into a default. One request has one outcome: it worked, or it did not.</p>
 *
 * <p>Throws rather than returning defaults. A caller that would rather show something than nothing
 * can catch it — but that has to be a decision someone made, not what happens by omission.</p>
 */
export async function getInvoiceSettings(token: string | null): Promise<InvoiceSettings> {
  const values = new Map<string, string>();

  for (let page = 1; page <= SETTINGS_MAX_PAGES; page += 1) {
    const { items, meta } = await listSettings(page, SETTINGS_PAGE_SIZE, token);
    items.forEach((setting) => values.set(setting.key, setting.value));

    if (page >= meta.totalPages) {
      break;
    }
  }

  const rate = Number(values.get(INVOICE_TAX_RATE_KEY));

  return {
    companyName: values.get(SHOP_NAME_KEY) ?? "",
    address: values.get(SHOP_ADDRESS_KEY) ?? "",
    phoneNumber: values.get(SHOP_CONTACT_NUMBER_KEY) ?? "",
    numberPrefix: values.get(INVOICE_NUMBER_PREFIX_KEY)?.trim() || DEFAULT_NUMBER_PREFIX,
    // Exactly as stored, blank included. Nothing is substituted for a blank — the slip simply has
    // no closing line, which is the point of leaving it blank.
    footerNote: values.get(INVOICE_FOOTER_NOTE_KEY) ?? "",
    // A stored value that isn't a usable rate falls back to no tax. Charging a customer on the
    // strength of an unparseable setting is the one outcome worth ruling out here.
    taxRatePercent: Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 0,
    tagline: values.get(SHOP_TAGLINE_KEY) ?? "",
    logoUrl: values.get(BRANDING_LOGO_URL_KEY) ?? "",
  };
}

/** Writes blanks through as blanks — clearing the address on this screen has to actually clear it. */
export async function saveInvoiceSettings(settings: InvoiceSettings, token: string | null): Promise<void> {
  const values: [string, string][] = [
    [SHOP_NAME_KEY, settings.companyName.trim()],
    [SHOP_ADDRESS_KEY, settings.address.trim()],
    [SHOP_CONTACT_NUMBER_KEY, settings.phoneNumber.trim()],
    [INVOICE_NUMBER_PREFIX_KEY, settings.numberPrefix.trim().toUpperCase()],
    [INVOICE_TAX_RATE_KEY, String(settings.taxRatePercent)],
    // The footer is not written here. Invoice Settings has no field for it any more, so writing it
    // back could only ever repeat what was read — or, if that read had failed, quietly overwrite a
    // value someone set elsewhere with a default nobody chose.
  ];

  for (const [key, value] of values) {
    await upsertSetting(key, value, token);
  }
}

/**
 * dd/MM/yyyy, on every invoice.
 *
 * <p>Assembled by hand rather than through a locale, so the slip reads the same on every machine in
 * the shop — a browser set to US English would otherwise print 08/14/2026 on one counter and
 * 14/08/2026 on the next.</p>
 */
export function formatInvoiceDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}/${date.getFullYear()}`;
}

/**
 * The same date with the clock time, for records where the moment matters — a payment taken at
 * 9:54 in the evening is a different fact from one taken that morning.
 *
 * <p>24-hour, and assembled the same way as the date above rather than through a locale, for the
 * same reason: two machines in one shop should not disagree about what a timestamp says.</p>
 */
export function formatInvoiceDateTime(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${formatInvoiceDate(iso)}, ${hours}:${minutes}`;
}

/**
 * The tax to send with a new invoice, given the order's own total.
 *
 * <p>Computed here rather than server-side because the API takes an amount, not a rate. Rounded to
 * the paisa the same way in every caller — a figure printed on a customer's invoice should not
 * depend on which screen raised it.</p>
 */
export function taxAmountFor(subtotal: number, taxRatePercent: number): number {
  if (taxRatePercent <= 0) {
    return 0;
  }

  return Math.round(subtotal * taxRatePercent) / 100;
}
