import { deleteSetting, listSettings, upsertSetting } from "@/lib/api/settings";
import { garmentNameError, normaliseGarmentName, type GarmentType } from "@/lib/api/garments";

/**
 * One key per garment — `Tailoring.Rate.Shirt` — rather than a single map of them all.
 *
 * The Activity Log records a setting's before-and-after value, so a key per garment makes a price
 * change read as "Tailoring.Rate.Shirt, 400 → 500". Held in one key, the same edit would be logged
 * as one JSON blob replacing another, which tells a reader nothing about what actually moved.
 */
export const TAILORING_RATE_KEY_PREFIX = "Tailoring.Rate.";

export function tailoringRateKey(garment: GarmentType): string {
  return `${TAILORING_RATE_KEY_PREFIX}${normaliseGarmentName(garment)}`;
}

/** Garment types the shop has priced. A garment with no entry is one nobody has set a rate for. */
export type TailoringRates = Partial<Record<GarmentType, number>>;

/** 100 is the server's ceiling (Shared/Constants/PaginationDefaults.cs). */
const SETTINGS_PAGE_SIZE = 100;
const SETTINGS_PAGE_LIMIT = 10;



/**
 * The shop's stitching prices.
 *
 * Read from the settings list in one sweep rather than one request per garment. A shop that has
 * never set them gets an empty price list, not an error — every Tailoring field simply starts blank.
 */
export async function getTailoringRates(token: string | null): Promise<TailoringRates> {
  const rates: TailoringRates = {};

  try {
    for (let page = 1; page <= SETTINGS_PAGE_LIMIT; page++) {
      const { items, meta } = await listSettings(page, SETTINGS_PAGE_SIZE, token);
      for (const setting of items) {
        if (!setting.key.startsWith(TAILORING_RATE_KEY_PREFIX)) {
          continue;
        }
        const garment = setting.key.slice(TAILORING_RATE_KEY_PREFIX.length);
        const amount = Number(setting.value);
        // Anything that is not a usable garment name or a usable amount is dropped rather than
        // trusted — these keys are editable by hand through Settings › Advanced.
        if (!garmentNameError(garment) && Number.isFinite(amount) && amount > 0) {
          rates[garment] = amount;
        }
      }
      if (page >= meta.totalPages) {
        break;
      }
    }
  } catch {
    // An unreachable settings list leaves the prices unknown rather than the screen broken.
  }

  return rates;
}

/**
 * Writes only what actually moved.
 *
 * A price left untouched is not re-saved, so it never appears in the Activity Log as a change that
 * did not happen; a price cleared has its key deleted rather than being stored as an empty string.
 */
export async function saveTailoringRates(
  next: TailoringRates,
  previous: TailoringRates,
  token: string | null,
): Promise<void> {
  const writes: Promise<unknown>[] = [];

  // Every garment named on either side, so a price removed with its garment is still cleaned up.
  const garments = new Set([...Object.keys(previous), ...Object.keys(next)]);

  for (const garment of garments) {
    const before = previous[garment];
    const after = next[garment];

    if (after === before) {
      continue;
    }
    writes.push(
      after === undefined
        ? deleteSetting(tailoringRateKey(garment), token)
        : upsertSetting(tailoringRateKey(garment), String(after), token),
    );
  }

  await Promise.all(writes);
}
