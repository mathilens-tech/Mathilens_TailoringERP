/**
 * Capitalisation applied as a field is typed, rather than on save.
 *
 * Staff enter a hundred names a day on a tablet keyboard, and a name that arrives as "ravi kumar"
 * is what then prints on the invoice. Fixing it at the keystroke is the only version anyone sees
 * the result of — a tidy-up on save is invisible until the record is reopened, and by then nobody
 * knows whether the shop or the software decided on the capital.
 *
 * Only the case changes: the length of the string is untouched, which is what lets the caller put
 * the caret back exactly where it was.
 */

/** "ravi kumar" becomes "Ravi Kumar". For names, addresses and other labels. */
export function capitalizeWords(value: string): string {
  // Start of the string or after a space — deliberately not after "." or "'", so "no.12" and
  // "d'souza" are left as the operator typed them rather than being second-guessed mid-word.
  return value.replace(/(^|\s)(\p{Ll})/gu, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}

/** "collect on friday. bring the old blouse" becomes "Collect on friday. Bring the old blouse". */
export function capitalizeSentences(value: string): string {
  // Free text, where title case would read as shouting: only the opening letter of the field and
  // of each sentence after it.
  return value.replace(
    /(^|[.!?]\s+|\n\s*)(\p{Ll})/gu,
    (_, lead: string, letter: string) => lead + letter.toUpperCase(),
  );
}
