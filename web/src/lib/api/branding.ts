import { getSetting, upsertSetting, SHOP_NAME_KEY, SHOP_CONTACT_NUMBER_KEY } from "./settings";

export const SHOP_ADDRESS_KEY = "Shop.Address";
/** The line under the shop name on a printed invoice — "All Types of Tailoring & Fabric Works". */
export const SHOP_TAGLINE_KEY = "Shop.Tagline";
export const BRANDING_LOGO_URL_KEY = "Branding.LogoUrl";
export const BRANDING_PRIMARY_COLOR_KEY = "Branding.PrimaryColor";
/** "business" or "standard" — which WhatsApp app a share opens. See `lib/whatsapp/provider`. */
export const WHATSAPP_APP_KEY = "WhatsApp.PreferredApp";

export type Branding = {
  shopName: string;
  tagline: string;
  contactNumber: string;
  address: string;
  logoUrl: string;
  primaryColor: string;
  /** Blank until the shop chooses, which reads as the default rather than as an app named "". */
  whatsAppApp: string;
};

export const EMPTY_BRANDING: Branding = {
  shopName: "",
  tagline: "",
  contactNumber: "",
  address: "",
  logoUrl: "",
  primaryColor: "",
  whatsAppApp: "",
};

const KEYS: Record<keyof Branding, string> = {
  shopName: SHOP_NAME_KEY,
  tagline: SHOP_TAGLINE_KEY,
  contactNumber: SHOP_CONTACT_NUMBER_KEY,
  address: SHOP_ADDRESS_KEY,
  logoUrl: BRANDING_LOGO_URL_KEY,
  primaryColor: BRANDING_PRIMARY_COLOR_KEY,
  whatsAppApp: WHATSAPP_APP_KEY,
};

/**
 * Reads all the settings at once. A key that has never been set 404s, which is the normal state
 * for a shop that hasn't customised anything — so a miss becomes an empty string rather than an
 * error, and one absent key never blanks the others.
 */
export async function getBranding(token: string | null): Promise<Branding> {
  const entries = await Promise.all(
    (Object.keys(KEYS) as (keyof Branding)[]).map(async (field) => {
      const setting = await getSetting(KEYS[field], token).catch(() => null);
      return [field, setting?.value ?? ""] as const;
    }),
  );

  return { ...EMPTY_BRANDING, ...Object.fromEntries(entries) };
}

/** Only writes what has a value — an empty field would otherwise be stored as an empty setting. */
export async function saveBranding(branding: Branding, token: string | null): Promise<void> {
  const changed = (Object.keys(KEYS) as (keyof Branding)[]).filter((field) => branding[field].trim() !== "");

  for (const field of changed) {
    await upsertSetting(KEYS[field], branding[field].trim(), token);
  }
}
