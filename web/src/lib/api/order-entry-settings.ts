import { getSetting, upsertSetting } from "@/lib/api/settings";
import type { OrderKind } from "@/lib/orders/order-kind";

/** The three New Order screens, in the order the settings page lists them. */
export const ORDER_KINDS_IN_ORDER: readonly OrderKind[] = ["fabric", "tailoring", "fabricTailoring"];

/**
 * The ranges the New Order screen's entry pads offer.
 *
 * <p>Both were numbers written into the code — quantity had no pad at all, and metres was hardcoded
 * 1 to 20 because that is what a cloth counter usually sells. "Usually" is the problem: a shop
 * selling curtain fabric works in tens of metres and one selling blouse pieces in ones, and neither
 * should be typing around a range chosen for the other.</p>
 *
 * <p>Ordinary settings keys, so this needs no schema and no migration — the same store that already
 * holds the shop name, the order prefix and the WhatsApp drafts.</p>
 */

export const QUANTITY_PAD_MIN_KEY = "Orders.QuantityPadMin";
export const QUANTITY_PAD_MAX_KEY = "Orders.QuantityPadMax";
export const METRES_PAD_MIN_KEY = "Orders.MetresPadMin";
export const METRES_PAD_MAX_KEY = "Orders.MetresPadMax";
export const MEASUREMENT_PAD_MIN_KEY = "Measurements.PadMin";
export const MEASUREMENT_PAD_MAX_KEY = "Measurements.PadMax";

/**
 * Which garments a new order opens with, in order — the first row, the second, and so on.
 *
 * <p>One key rather than a count and a list, because the list already answers both: how many rows
 * to open is how many entries it has. A separate count would be a second thing to keep in step, and
 * a shop that set the count to four and named three garments would have invented a question nobody
 * has an answer to.</p>
 */
export const DEFAULT_ITEM_GARMENTS_KEY = "Orders.DefaultItemGarments";

/**
 * Per screen, because the three ask for different things.
 *
 * <p>A counter sale opens on cloth lines that carry no garment at all; a tailoring order opens on
 * the garments the shop stitches most; a fabric-and-tailoring order may well open on a different
 * pair again. One shared list forced a shop to pick opening rows that suited whichever screen it
 * used most and put up with them on the other two.</p>
 *
 * <p>The old single key is still read as the fallback for all three, so a shop that configured it
 * before this split keeps what it chose rather than being reset to the built-ins.</p>
 */
export const DEFAULT_ITEM_GARMENTS_KEYS: Record<OrderKind, string> = {
  fabric: "Orders.DefaultItemGarments.Fabric",
  tailoring: "Orders.DefaultItemGarments.Tailoring",
  fabricTailoring: "Orders.DefaultItemGarments.FabricTailoring",
};

export type PadRange = { min: number; max: number };

/** One of most garments, and a dozen covers a family's order. */
export const DEFAULT_QUANTITY_RANGE: PadRange = { min: 1, max: 12 };

/** What the metres pad offered before it could be configured. */
export const DEFAULT_METRES_RANGE: PadRange = { min: 1, max: 20 };

/**
 * The fallback for a measurement point the shop has not given a range of its own.
 *
 * <p>Wide, because it has to serve a neck and a shirt length with one span — a range narrow enough
 * to be tidy for one would be missing values for the other. A point measured often enough for that
 * to matter is worth setting a range on, under Settings › Measurement, and its own range always
 * wins over this.</p>
 */
export const DEFAULT_MEASUREMENT_RANGE: PadRange = { min: 1, max: 60 };

/**
 * What a new order opens with: a shirt and a trousers, which is the order a counter takes most
 * often. Named garments rather than blank rows so the common case needs no dropdown at all.
 */
export const DEFAULT_ITEM_GARMENTS: readonly string[] = ["Shirt", "Trousers"];

/** Enough rows to open on that nobody is scrolling past empty ones to reach Add item. */
export const MAX_DEFAULT_ITEMS = 10;

export type OrderEntrySettings = {
  quantity: PadRange;
  metres: PadRange;
  /** Used by any numeric measurement point with no range of its own. */
  measurement: PadRange;
  /**
   * The garment on each opening row, in order, per screen. Empty means open with no rows at all,
   * which is a real choice for a shop that starts every order from Add item.
   */
  defaultItemGarments: Record<OrderKind, string[]>;
};

/**
 * A stored value as a range bound, or the default when it is missing or nonsense.
 *
 * <p>These keys are editable by hand through Settings › Advanced, so "12" is not guaranteed — and a
 * pad built from a blank or a word would either be empty or enormous. Falling back is what keeps a
 * mistyped setting a cosmetic problem rather than a screen nobody can use.</p>
 */
function toBound(raw: string | undefined, fallback: number): number {
  const parsed = Number((raw ?? "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

/**
 * Both ranges, in one read.
 *
 * <p>Never rejects: a shop that has never opened the settings page is the normal case, not an
 * error, and the order screen has to open either way.</p>
 */
export async function getOrderEntrySettings(token: string | null): Promise<OrderEntrySettings> {
  const value = async (key: string): Promise<string | undefined> => {
    try {
      return (await getSetting(key, token)).value;
    } catch {
      return undefined;
    }
  };

  const [qMin, qMax, mMin, mMax, sMin, sMax, garments] = await Promise.all([
    value(QUANTITY_PAD_MIN_KEY),
    value(QUANTITY_PAD_MAX_KEY),
    value(METRES_PAD_MIN_KEY),
    value(METRES_PAD_MAX_KEY),
    value(MEASUREMENT_PAD_MIN_KEY),
    value(MEASUREMENT_PAD_MAX_KEY),
    value(DEFAULT_ITEM_GARMENTS_KEY),
  ]);

  // Per screen, falling back to the old shared key and then to the built-ins — so a shop that set
  // opening rows before this was split per screen keeps them on all three.
  const perKind = await Promise.all(
    ORDER_KINDS_IN_ORDER.map(async (kind) => [kind, await value(DEFAULT_ITEM_GARMENTS_KEYS[kind])] as const),
  );

  return {
    quantity: sane(
      toBound(qMin, DEFAULT_QUANTITY_RANGE.min),
      toBound(qMax, DEFAULT_QUANTITY_RANGE.max),
      DEFAULT_QUANTITY_RANGE,
    ),
    metres: sane(
      toBound(mMin, DEFAULT_METRES_RANGE.min),
      toBound(mMax, DEFAULT_METRES_RANGE.max),
      DEFAULT_METRES_RANGE,
    ),
    measurement: sane(
      toBound(sMin, DEFAULT_MEASUREMENT_RANGE.min),
      toBound(sMax, DEFAULT_MEASUREMENT_RANGE.max),
      DEFAULT_MEASUREMENT_RANGE,
    ),
    defaultItemGarments: Object.fromEntries(
      perKind.map(([kind, raw]) => [kind, toGarmentList(raw ?? garments)]),
    ) as Record<OrderKind, string[]>,
  };
}

/**
 * The stored list, or the built-in one when it is missing or unreadable.
 *
 * <p>An empty array is a real answer and is kept — a shop that wants every order to start from Add
 * item has said so. Only an absent or malformed key falls back, which is the difference between
 * "chose none" and "never chose".</p>
 */
function toGarmentList(raw: string | undefined): string[] {
  if (raw === undefined) {
    return [...DEFAULT_ITEM_GARMENTS];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_ITEM_GARMENTS];
    }
    // Blanks dropped and the list capped, because this key is editable by hand through Settings ›
    // Advanced and a new order should not open with fifty rows or a row for a garment named "".
    return parsed
      .filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
      .map((entry) => entry.trim())
      .slice(0, MAX_DEFAULT_ITEMS);
  } catch {
    return [...DEFAULT_ITEM_GARMENTS];
  }
}

/** A range the wrong way round cannot lay out a pad, so it falls back whole rather than half. */
function sane(min: number, max: number, fallback: PadRange): PadRange {
  return max > min ? { min, max } : fallback;
}

export async function saveOrderEntrySettings(settings: OrderEntrySettings, token: string | null): Promise<void> {
  await Promise.all([
    upsertSetting(QUANTITY_PAD_MIN_KEY, String(settings.quantity.min), token),
    upsertSetting(QUANTITY_PAD_MAX_KEY, String(settings.quantity.max), token),
    upsertSetting(METRES_PAD_MIN_KEY, String(settings.metres.min), token),
    upsertSetting(METRES_PAD_MAX_KEY, String(settings.metres.max), token),
    upsertSetting(MEASUREMENT_PAD_MIN_KEY, String(settings.measurement.min), token),
    upsertSetting(MEASUREMENT_PAD_MAX_KEY, String(settings.measurement.max), token),
    ...ORDER_KINDS_IN_ORDER.map((kind) =>
      upsertSetting(DEFAULT_ITEM_GARMENTS_KEYS[kind], JSON.stringify(settings.defaultItemGarments[kind]), token),
    ),
  ]);

  // Every open screen reading these picks the change up without a reload — the measurement fields
  // in particular are on a screen somebody may well have open while this is being changed.
  invalidateOrderEntrySettings();
}

/**
 * The settings, cached for the whole app.
 *
 * <p>Shop-level configuration that changes about once, read by every measurement field on a screen
 * that can hold thirty of them. Fetching per field would be thirty requests to answer one question,
 * so the first caller fetches and the rest wait on the same promise.</p>
 */
let cache: OrderEntrySettings | null = null;
let inFlight: Promise<OrderEntrySettings> | null = null;
/** Told that the cache is stale, not what replaced it — each refetches with its own token. */
const subscribers = new Set<() => void>();

export function invalidateOrderEntrySettings() {
  cache = null;
  inFlight = null;
  // Subscribers refetch with their own token rather than being handed a value fetched here.
  //
  // This used to call loadOrderEntrySettings(null) and push the result. There is no token at module
  // scope, so that request went out unauthenticated, failed, and every value fell back to its
  // default — which was then cached and pushed to every open screen. Saving a setting therefore
  // appeared to do nothing at all, because the save worked and the cache was immediately refilled
  // with the built-ins.
  subscribers.forEach((notify) => notify());
}

export function loadOrderEntrySettings(token: string | null): Promise<OrderEntrySettings> {
  if (cache !== null) {
    return Promise.resolve(cache);
  }
  inFlight ??= getOrderEntrySettings(token).then((loaded) => {
    cache = loaded;
    inFlight = null;
    return loaded;
  });
  return inFlight;
}

export function subscribeToOrderEntrySettings(notify: () => void): () => void {
  subscribers.add(notify);
  return () => subscribers.delete(notify);
}

/** Defaults until the first read lands, so a field is never briefly unusable. */
export const DEFAULT_ORDER_ENTRY_SETTINGS: OrderEntrySettings = {
  quantity: DEFAULT_QUANTITY_RANGE,
  metres: DEFAULT_METRES_RANGE,
  measurement: DEFAULT_MEASUREMENT_RANGE,
  defaultItemGarments: {
    // A counter sale has no garment on its rows — it opens on one blank cloth line, which is what
    // an empty list plus the editor's own "+ Add item" gives. Naming shirts here would put garment
    // names on a receipt for a length of cloth.
    fabric: [],
    tailoring: [...DEFAULT_ITEM_GARMENTS],
    fabricTailoring: [...DEFAULT_ITEM_GARMENTS],
  },
};
