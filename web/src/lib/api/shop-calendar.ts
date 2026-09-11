import { getSetting, upsertSetting } from "@/lib/api/settings";

/**
 * Which weekdays the shop is shut, as JSON day numbers — `[0]` for a shop closed on Sundays,
 * `[0, 5]` for one closed Sunday and Friday. 0 is Sunday, matching Date.getDay().
 */
export const WEEKLY_OFF_DAYS_KEY = "Shop.WeeklyOffDays";

/**
 * One-off closures, as a JSON array of `{ date, name }` — `[{"date":"2026-11-08","name":"Diwali"}]`.
 *
 * Plain `"2026-11-08"` strings are still read, since that is what the first version of this setting
 * wrote; they load with an empty name and are rewritten in the new shape on the next save.
 */
export const SHOP_HOLIDAYS_KEY = "Shop.Holidays";

/** A day the shop is shut, and what to call it — "Diwali" tells staff far more than the date does. */
export type Holiday = {
  /** yyyy-MM-dd. */
  date: string;
  name: string;
};

export type ShopCalendar = {
  /** Day numbers the shop is closed every week. 0 = Sunday. */
  weeklyOffDays: number[];
  /** Closures sorted by date, earliest first. */
  holidays: Holiday[];
};

/** `short` for controls that sit in a row; `label` for prose, where an abbreviation reads as shouting. */
export const WEEKDAYS: readonly { value: number; short: string; label: string }[] = [
  { value: 0, short: "SUN", label: "Sunday" },
  { value: 1, short: "MON", label: "Monday" },
  { value: 2, short: "TUE", label: "Tuesday" },
  { value: 3, short: "WED", label: "Wednesday" },
  { value: 4, short: "THU", label: "Thursday" },
  { value: 5, short: "FRI", label: "Friday" },
  { value: 6, short: "SAT", label: "Saturday" },
];

/**
 * What a shop gets before anyone opens the Working Days page: closed Sundays, no holidays.
 *
 * Sunday rather than nothing, because a blank default would quietly go on pre-filling collection
 * dates onto the one day almost every tailor is shut — the case that prompted this in the first
 * place. A shop that works Sundays unticks it.
 */
export const DEFAULT_SHOP_CALENDAR: ShopCalendar = { weeklyOffDays: [0], holidays: [] };

function parseWeeklyOffDays(raw: string): number[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return DEFAULT_SHOP_CALENDAR.weeklyOffDays;
    }
    // Anything that isn't a real day number is dropped rather than trusted — this value can be
    // edited by hand through Settings › Advanced, so it is not guaranteed to be well formed.
    return [...new Set(parsed.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  } catch {
    return DEFAULT_SHOP_CALENDAR.weeklyOffDays;
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** How long a holiday name may be — "Diwali", not an essay, and the whole list shares one 4000-character setting. */
export const HOLIDAY_NAME_MAX_LENGTH = 60;

function parseHolidays(raw: string): Holiday[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const byDate = new Map<string, Holiday>();
    for (const entry of parsed) {
      // A bare string is the original format — keep the day off, and let someone name it later.
      if (typeof entry === "string" && ISO_DATE.test(entry)) {
        byDate.set(entry, { date: entry, name: "" });
        continue;
      }
      if (typeof entry === "object" && entry !== null) {
        const { date, name } = entry as { date?: unknown; name?: unknown };
        if (typeof date === "string" && ISO_DATE.test(date)) {
          byDate.set(date, {
            date,
            name: typeof name === "string" ? name.slice(0, HOLIDAY_NAME_MAX_LENGTH) : "",
          });
        }
      }
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

/**
 * The shop's closed days.
 *
 * Either key being absent is the normal state of a shop that has never opened the page, not an
 * error — a missing key falls back to the default rather than failing the screen that asked.
 */
export async function getShopCalendar(token: string | null): Promise<ShopCalendar> {
  const [weeklyOff, holidays] = await Promise.all([
    getSetting(WEEKLY_OFF_DAYS_KEY, token)
      .then((s) => parseWeeklyOffDays(s.value))
      .catch(() => DEFAULT_SHOP_CALENDAR.weeklyOffDays),
    getSetting(SHOP_HOLIDAYS_KEY, token)
      .then((s) => parseHolidays(s.value))
      .catch(() => DEFAULT_SHOP_CALENDAR.holidays),
  ]);

  return { weeklyOffDays: weeklyOff, holidays };
}

export async function saveShopCalendar(calendar: ShopCalendar, token: string | null): Promise<void> {
  const holidays = [...calendar.holidays].sort((a, b) => a.date.localeCompare(b.date));
  await Promise.all([
    upsertSetting(WEEKLY_OFF_DAYS_KEY, JSON.stringify([...calendar.weeklyOffDays].sort()), token),
    upsertSetting(SHOP_HOLIDAYS_KEY, JSON.stringify(holidays), token),
  ]);
}

/** yyyy-MM-dd off the local calendar — a shop's closing day is a day, not a UTC instant. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromIsoDate(isoDate: string): Date | null {
  if (!ISO_DATE.test(isoDate)) {
    return null;
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Whether the shop is shut that day, for either reason. */
export function isShopClosed(isoDate: string, calendar: ShopCalendar): boolean {
  const date = fromIsoDate(isoDate);
  if (!date) {
    return false;
  }
  return calendar.weeklyOffDays.includes(date.getDay()) || calendar.holidays.some((h) => h.date === isoDate);
}

/**
 * The first day from `isoDate` onward that the shop is actually open.
 *
 * Rolls forward, never back: a collection date landing on a closed day means the customer waits
 * until the shop reopens, not that the tailor is asked to finish a day early.
 *
 * Gives up after two weeks and returns the date unchanged. A shop that has managed to mark every
 * weekday as an off day would otherwise loop forever, and a wrong-but-visible date the operator
 * can correct beats a frozen screen.
 */
export function nextOpenDay(isoDate: string, calendar: ShopCalendar): string {
  const date = fromIsoDate(isoDate);
  if (!date) {
    return isoDate;
  }

  for (let attempts = 0; attempts < 14; attempts++) {
    const candidate = toIsoDate(date);
    if (!isShopClosed(candidate, calendar)) {
      return candidate;
    }
    date.setDate(date.getDate() + 1);
  }

  return isoDate;
}
