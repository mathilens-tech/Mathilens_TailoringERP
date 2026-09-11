/**
 * Phone and email rules, mirroring `src/Shared/Contact/IndianPhoneNumber.cs` and
 * `EmailAddress.cs` on the server.
 *
 * Duplicated deliberately: the server is the authority and rejects anything these miss, but a
 * counter typing a customer in wants to be told about a mistyped number while the field is still
 * under the cursor, not after a round trip. Keep the two in step — if the C# rules change, these
 * change with them.
 */

const COUNTRY_CODE = "+91";

/** Separators people actually type, removed before the digits are read. */
const SEPARATORS = /[\s\-()]/g;

/**
 * Turns a typed number into the canonical `+91XXXXXXXXXX`, or null when it isn't one.
 *
 * Read by digit count: ten is a bare national number, twelve beginning 91 already carries the
 * country code, eleven beginning 0 carries the old trunk prefix.
 */
export function normalizePhoneNumber(raw: string): string | null {
  const compact = raw.replace(SEPARATORS, "");
  // A letter or a slash means this was never one phone number, and stripping the difference
  // would invent one.
  if (!/^\+?\d+$/.test(compact)) {
    return null;
  }

  const digits = compact.replace(/^\+/, "");

  if (digits.length === 10) {
    return COUNTRY_CODE + digits;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return "+" + digits;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return COUNTRY_CODE + digits.slice(1);
  }
  return null;
}

/**
 * The ten digits a customer would recite, from whatever is stored or pasted.
 *
 * <p>The form deals in ten digits and nothing else; the database deals in `+91XXXXXXXXXX`. This is
 * the seam between them, used both to fill the field from a saved record and to clean up what
 * lands in it. Pasting "+91 82200-70363", "918220070363" or "08220070363" all leave 8220070363
 * behind, so a number copied from a message or a spreadsheet drops in whole.</p>
 *
 * <p>Anything it can't read is handed back as its bare digits rather than trimmed to fit — cutting
 * an unrecognized number down to ten characters would turn it into a different, plausible number.
 * Those get rejected on save instead, where the operator can see why.</p>
 */
export function toNationalDigits(raw: string): string {
  const normalized = normalizePhoneNumber(raw);
  return normalized === null ? raw.replace(/\D/g, "") : normalized.slice(COUNTRY_CODE.length);
}

/**
 * A stored number as it should be read on screen — the ten digits, without the country code.
 *
 * <p>Storage stays canonical: `+91XXXXXXXXXX` is what the import, the WhatsApp module and the
 * uniqueness checks all correlate on, and it is not this function's business to change that. But
 * nobody at the counter says "+91" out loud, and it is noise in every table, every invoice and
 * every "already exists" message. This is the seam — canonical below, ten digits wherever a
 * person reads it.</p>
 *
 * <p>Mirrors `IndianPhoneNumber.ToDisplay` on the server, which does the same for the messages
 * the server writes. Anything it cannot read is handed back untouched rather than trimmed: cutting
 * an unrecognized number down would show a different, plausible number.</p>
 */
export function toDisplayPhoneNumber(raw: string | null | undefined): string {
  if (!raw) {
    return "";
  }
  const normalized = normalizePhoneNumber(raw);
  return normalized === null ? raw.trim() : normalized.slice(COUNTRY_CODE.length);
}

/**
 * The message for a phone number that won't do, or null when it will.
 *
 * The wording matches the server's exactly, so a number caught here and a number caught there
 * never explain themselves two different ways.
 */
export function phoneNumberError(raw: string): string | null {
  if (raw.trim() === "") {
    return "Phone number is required.";
  }

  const normalized = normalizePhoneNumber(raw);
  if (normalized === null) {
    return "Phone number must be 10 digits.";
  }
  // Ten digits and still wrong: telling them to count again would send them looking in the wrong
  // place, so name the digit that is actually the problem.
  if (!/^[6-9]$/.test(normalized[COUNTRY_CODE.length])) {
    return "Phone number must start with 6, 7, 8 or 9.";
  }
  return null;
}

/** The same shape check the server applies — something@something.something. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Optional field: blank is fine, wrong is not. */
export function emailError(raw: string): string | null {
  const value = raw.trim();
  if (value === "" || EMAIL_PATTERN.test(value)) {
    return null;
  }
  return "Enter a valid email address.";
}
