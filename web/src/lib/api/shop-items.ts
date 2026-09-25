import { listSettings } from "@/lib/api/settings";
import { DEFAULT_GARMENTS, GARMENT_KEY_PREFIX, garmentNameError, normaliseGarmentName, type Garment } from "@/lib/api/garments";
import { TAILORING_RATE_KEY_PREFIX, type TailoringRates } from "@/lib/api/tailoring-rates";

/** 100 is the server's ceiling (Shared/Constants/PaginationDefaults.cs). */
const SETTINGS_PAGE_SIZE = 100;
const SETTINGS_PAGE_LIMIT = 10;

export type ShopItemConfig = {
  garments: Garment[];
  rates: TailoringRates;
  /**
   * True when the settings list could not be read, as opposed to having been read and found empty.
   *
   * <p>The distinction is the whole reason this type exists. A shop that has priced nothing and a
   * shop whose prices could not be fetched produce the same empty rate list, and the New Order
   * screen used to render both as "set a price under Settings › Tailoring Cost" — telling somebody
   * to go and configure what they had already configured.</p>
   */
  failed: boolean;
};

/**
 * Everything an item row needs to exist: what the shop stitches, and what it charges.
 *
 * <p><b>One sweep, not two.</b> Garments and tailoring rates are both stored as settings keys, and
 * reading them through their own functions paginated the entire settings list twice on every New
 * Order load. They are read together here because they are used together — an unpriced garment is
 * not offered, so neither answer is usable without the other.</p>
 *
 * <p><b>Why the fallbacks differ.</b> Garments fall back to the shipped list, because a New Order
 * with nothing to pick is useless and the standard names are nearly always right. Prices have no
 * such fallback — inventing one would put a figure the shop never agreed to on a customer's bill.
 * That asymmetry is deliberate but it used to be silent, and silence is what made it a bug: the
 * garment list survived a failed read while the prices did not, the screen offered only priced
 * garments, and the two together left the item editor with nothing at all.</p>
 */
export async function getShopItemConfig(token: string | null): Promise<ShopItemConfig> {
  const names: string[] = [];
  const rates: TailoringRates = {};

  try {
    for (let page = 1; page <= SETTINGS_PAGE_LIMIT; page++) {
      const { items, meta } = await listSettings(page, SETTINGS_PAGE_SIZE, token);

      for (const setting of items) {
        if (setting.key.startsWith(GARMENT_KEY_PREFIX)) {
          const name = normaliseGarmentName(setting.key.slice(GARMENT_KEY_PREFIX.length));
          // These keys are editable by hand through Settings › Advanced, so anything unusable is
          // dropped rather than trusted.
          if (name && !garmentNameError(name) && !names.some((n) => n.toLowerCase() === name.toLowerCase())) {
            names.push(name);
          }
          continue;
        }

        if (setting.key.startsWith(TAILORING_RATE_KEY_PREFIX)) {
          const garment = setting.key.slice(TAILORING_RATE_KEY_PREFIX.length);
          const amount = Number(setting.value);
          if (!garmentNameError(garment) && Number.isFinite(amount) && amount > 0) {
            rates[garment] = amount;
          }
        }
      }

      if (page >= meta.totalPages) {
        break;
      }
    }
  } catch {
    // Reported rather than hidden. The caller decides what to say; what it must not do is present
    // this as a shop that has not been set up.
    return { garments: DEFAULT_GARMENTS.map((name) => ({ name })), rates: {}, failed: true };
  }

  return {
    garments: names.length > 0 ? names.map((name) => ({ name })) : DEFAULT_GARMENTS.map((name) => ({ name })),
    rates,
    failed: false,
  };
}
