/**
 * The seam between the date a person reads and the date the API speaks.
 *
 * Storage and every API contract use ISO `yyyy-MM-dd`, which is also the only format
 * `<input type="date">` accepts in its `value`. The shop reads dates as `DD-MM-YYYY`. Neither
 * side bends, so the conversion lives here rather than being rewritten per screen.
 *
 * Why this exists at all: a native date input renders in the *browser's* locale, which is
 * mm/dd/yyyy on a machine set to en-US, and no attribute changes it — `lang` is ignored for this.
 * See DateInput, which is what every date field on the dashboard uses.
 */

/** "26-08-2026" from "2026-08-26". Empty for anything that is not a full ISO date. */
export function toDisplayDate(isoDate: string): string {
  const [year, month, day] = (isoDate ?? "").split("-");
  return year && month && day ? `${day}-${month}-${year}` : "";
}

/** "2026-08-26" from a displayed "26-08-2026", or "" if it is not a real date. */
export function fromDisplayDate(text: string): string {
  const digits = (text ?? "").replace(/\D/g, "");
  if (digits.length !== 8) {
    return "";
  }

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));

  // Round-tripped through Date because the constructor rolls 31-02 forward into March rather than
  // refusing it — comparing the parts back is what catches a day that does not exist.
  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) {
    return "";
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
