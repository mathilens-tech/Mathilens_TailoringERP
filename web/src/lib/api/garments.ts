import { deleteSetting, listSettings, upsertSetting } from "@/lib/api/settings";
import { GARMENT_TYPES, type GarmentType } from "@/lib/api/measurements";

/**
 * One key per garment — `Garment.Chudidhar` — with the name as both the key and the value.
 *
 * A row each rather than one row holding a list: the Activity Log records a setting's
 * before-and-after, so adding a garment reads as `Garment.Chudidhar` appearing, not as one JSON
 * blob replacing another. Same shape the tailoring rates use.
 *
 * The name is the garment's identity. It is what an order stores against its items, which is why
 * renaming one leaves orders already placed reading the old name — they record what was stitched
 * at the time, and rewriting history to match a later spelling would be worse.
 */
export const GARMENT_KEY_PREFIX = "Garment.";

export function garmentKey(name: string): string {
  return `${GARMENT_KEY_PREFIX}${normaliseGarmentName(name)}`;
}

/** One row of the garment master. */
export type Garment = { name: string };

/**
 * Matches GarmentTypes.MaxLength on the API, which matches the column. A longer name is refused
 * server-side, so it is refused here first.
 */
export const GARMENT_NAME_MAX_LENGTH = 50;

/**
 * Trimmed and with runs of spaces collapsed — the same rule the API applies, so " Saree  Blouse "
 * and "Saree Blouse" cannot become two garments that look identical on screen.
 */
export function normaliseGarmentName(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).join(" ");
}

/** Storable: present, inside the column, and free of the characters that break a settings key. */
export function garmentNameError(name: string): string | null {
  const normalised = normaliseGarmentName(name);
  if (!normalised) {
    return "Enter a name for this garment.";
  }
  if (normalised.length > GARMENT_NAME_MAX_LENGTH) {
    return `Keep it to ${GARMENT_NAME_MAX_LENGTH} characters or fewer.`;
  }
  // The name becomes part of a settings key and a URL segment; a control character would survive
  // neither, and would be invisible in the box that typed it. Checked by code point rather than a
  // regex so the literal cannot smuggle a raw control byte into this file.
  if ([...normalised].some((ch) => ch.codePointAt(0)! < 0x20 || ch.codePointAt(0)! === 0x7f)) {
    return "That name contains characters that cannot be stored.";
  }
  return null;
}

/** The garments this system ships with, offered to a shop that has chosen no list of its own. */
export const DEFAULT_GARMENTS: readonly string[] = GARMENT_TYPES.filter((garment) => garment !== "Other");

/** 100 is the server's ceiling (Shared/Constants/PaginationDefaults.cs). */
const SETTINGS_PAGE_SIZE = 100;
const SETTINGS_PAGE_LIMIT = 10;

/**
 * The shop's garment list, in the order it was stored.
 *
 * A shop that has never opened the master gets the shipped list — it starts complete rather than
 * empty, so New Order and Tailoring Cost work on day one without a setup step.
 */
export async function getGarments(token: string | null): Promise<Garment[]> {
  const names: string[] = [];

  try {
    for (let page = 1; page <= SETTINGS_PAGE_LIMIT; page++) {
      const { items, meta } = await listSettings(page, SETTINGS_PAGE_SIZE, token);
      for (const setting of items) {
        if (!setting.key.startsWith(GARMENT_KEY_PREFIX)) {
          continue;
        }
        const name = normaliseGarmentName(setting.key.slice(GARMENT_KEY_PREFIX.length));
        // These keys are editable by hand through Settings › Advanced, so anything unusable is
        // dropped rather than trusted.
        if (name && !garmentNameError(name) && !names.some((n) => n.toLowerCase() === name.toLowerCase())) {
          names.push(name);
        }
      }
      if (page >= meta.totalPages) {
        break;
      }
    }
  } catch {
    // An unreachable settings list falls through to the shipped list rather than an empty screen —
    // a New Order with no garments to pick is worse than one showing the standard names.
    return DEFAULT_GARMENTS.map((name) => ({ name }));
  }

  return (names.length > 0 ? names : [...DEFAULT_GARMENTS]).map((name) => ({ name }));
}

/** Puts a garment on the list. Writing the key is what adds it. */
export function addGarment(name: string, token: string | null): Promise<unknown> {
  const normalised = normaliseGarmentName(name);
  return upsertSetting(garmentKey(normalised), normalised, token);
}

/**
 * Takes a garment off the list.
 *
 * Nothing is destroyed: orders already placed keep the garment they recorded, and adding the name
 * back restores it.
 */
export function removeGarment(name: string, token: string | null): Promise<void> {
  return deleteSetting(garmentKey(name), token);
}

/**
 * Changes what the shop calls a garment.
 *
 * The name is the key, so this is a write of the new one and a delete of the old rather than an
 * edit in place. Written first: if the delete then fails the shop is looking at a duplicate, which
 * it can remove — whereas deleting first and failing to write would lose the garment outright.
 *
 * Only the entry on this list moves. What the shop charges to stitch it and the measurement points
 * it asks for are keyed by name as well, and the caller has to carry those across; see the Garments
 * screen, which does. Orders already placed keep the old name deliberately — they record what was
 * stitched at the time.
 */
export async function renameGarment(from: string, to: string, token: string | null): Promise<void> {
  const before = normaliseGarmentName(from);
  const after = normaliseGarmentName(to);

  if (before === after) {
    return;
  }

  // Keys are matched byte for byte on the server, so "Garment.blouse" and "Garment.Blouse" are two
  // rows: correcting only the capitalisation is a real rename and still has to clear the old key.
  await upsertSetting(garmentKey(after), after, token);
  await deleteSetting(garmentKey(before), token);
}

/**
 * Whether this shop has ever stored a garment list of its own.
 *
 * getGarments hands back the shipped list when it finds no keys, so a caller cannot tell a chosen
 * list from a defaulted one by reading it — and writing a single key against a defaulted list would
 * leave that one key as the entire list.
 */
export async function hasStoredGarments(token: string | null): Promise<boolean> {
  try {
    for (let page = 1; page <= SETTINGS_PAGE_LIMIT; page++) {
      const { items, meta } = await listSettings(page, SETTINGS_PAGE_SIZE, token);
      if (items.some((setting) => setting.key.startsWith(GARMENT_KEY_PREFIX))) {
        return true;
      }
      if (page >= meta.totalPages) {
        break;
      }
    }
  } catch {
    // Unknown, so assume it exists rather than overwriting a list that may already be there.
    return true;
  }
  return false;
}

/** Writes the shipped list, for a shop that has never had one of its own. */
export async function seedGarments(token: string | null): Promise<void> {
  await Promise.all(DEFAULT_GARMENTS.map((name) => upsertSetting(garmentKey(name), name, token)));
}

/** Re-exported so callers do not have to know a garment name is just a string. */
export type { GarmentType };
