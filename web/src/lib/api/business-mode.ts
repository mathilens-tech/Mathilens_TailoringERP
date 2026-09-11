import { getSetting, upsertSetting } from "@/lib/api/settings";

/**
 * What the shop is selling.
 *
 * "tailoring" is a shop that only stitches — the customer brings the cloth and pays for the work.
 * "tailoringFabric" is a shop that also sells cloth, so each garment on an order says whose fabric
 * it is made from and, when it is the shop's own, what that cloth costs.
 */
export type BusinessMode = "tailoring" | "tailoringFabric";

/**
 * Which of the two trades this shop is in.
 *
 * A property of the shop, not of the order: a shop that does not sell cloth never wants to be asked
 * about it, and one that does sells it every day. The exception — a customer walking in with their
 * own material — is handled per item on the order itself (Shop fabric / Customer fabric), so a
 * fabric shop loses nothing by settling this once here.
 */
export const BUSINESS_MODE_KEY = "Shop.BusinessMode";

/**
 * Tailoring-only until someone says otherwise — it is the simpler form, and a shop that has never
 * opened this page should not be asked for a cloth code it has no answer for.
 */
export const DEFAULT_BUSINESS_MODE: BusinessMode = "tailoring";

/** The choices, as the settings screen presents them. */
export const BUSINESS_MODES: readonly { value: BusinessMode; label: string }[] = [
  { value: "tailoring", label: "Tailoring" },
  { value: "tailoringFabric", label: "Tailoring + fabric" },
];

function parse(raw: string): BusinessMode {
  // Compared against the known values rather than cast: this key is editable by hand through
  // Settings › Advanced, so it is not guaranteed to hold either of them.
  return BUSINESS_MODES.some((mode) => mode.value === raw) ? (raw as BusinessMode) : DEFAULT_BUSINESS_MODE;
}

/**
 * The shop's trade.
 *
 * Never rejects: the key being absent is the normal state of a shop that has never opened the
 * settings page, not an error, and the New Order screen has to open either way.
 */
export function getBusinessMode(token: string | null): Promise<BusinessMode> {
  return getSetting(BUSINESS_MODE_KEY, token)
    .then((setting) => parse(setting.value))
    .catch(() => DEFAULT_BUSINESS_MODE);
}

export async function saveBusinessMode(mode: BusinessMode, token: string | null): Promise<void> {
  await upsertSetting(BUSINESS_MODE_KEY, mode, token);
}
