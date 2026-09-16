import { type InputHTMLAttributes, type Ref, type TextareaHTMLAttributes } from "react";
import { capitalizeSentences, capitalizeWords } from "@/lib/text";

/**
 * Fields that are not prose and must be left exactly as typed: an address bar case-folds, a
 * password does not, and a phone keypad has no capitals to give.
 */
const NOT_PROSE_TYPES = new Set(["email", "password", "tel", "url", "number", "date", "time", "search", "hidden"]);
const NUMERIC_MODES = new Set(["numeric", "decimal", "tel"]);

/**
 * Which transform, if any, a field gets — driven by the standard `autoCapitalize` attribute so a
 * caller opts out with `autoCapitalize="none"` (the search boxes do) and the mobile keyboard is
 * told the same thing the code is doing.
 */
function resolveTransform(
  requested: string | undefined,
  type: string | undefined,
  inputMode: string | undefined,
  fallback: "words" | "sentences",
): ((value: string) => string) | null {
  const leaveAlone = NOT_PROSE_TYPES.has(type ?? "text") || NUMERIC_MODES.has(inputMode ?? "");
  const mode = requested ?? (leaveAlone ? "none" : fallback);

  if (mode === "words") {
    return capitalizeWords;
  }
  if (mode === "sentences") {
    return capitalizeSentences;
  }
  return null;
}

/**
 * Rewrites the value on the element itself, before the change reaches the caller's handler, so the
 * caller stores the capitalised text and React never sees the two disagree.
 *
 * The caret is put back by hand: assigning `value` sends it to the end of the field, which on a
 * mid-sentence edit would drop the next keystroke in the wrong place. Only the case changed, so
 * the offset that was right before is still right after.
 */
function capitalizeInPlace(element: HTMLInputElement | HTMLTextAreaElement, transform: (value: string) => string) {
  const next = transform(element.value);
  if (next === element.value) {
    return;
  }

  const caret = element.selectionStart;
  element.value = next;
  if (caret !== null) {
    element.setSelectionRange(caret, caret);
  }
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  /**
   * Declared explicitly because InputHTMLAttributes does not carry it. React 19 passes ref through
   * as an ordinary prop, so the spread below lands it on the input with no forwardRef wrapper.
   */
  ref?: Ref<HTMLInputElement>;
};

export function Input({ label, error, id, className = "", autoCapitalize, onChange, ...props }: InputProps) {
  // Words rather than sentences: a text field on this dashboard is nearly always a name, a place
  // or a cloth — things written in title case on the invoice they end up on.
  const transform = resolveTransform(autoCapitalize, props.type, props.inputMode, "words");

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        autoCapitalize={autoCapitalize ?? (transform ? "words" : undefined)}
        // What keyboard a phone or tablet should open for a number field.
        //
        // type="number" alone does not settle this. It tells the browser what the value must be,
        // not what to open — and a tablet will happily present a full text keyboard, leaving
        // somebody at a counter hunting for a digit. Every number field in this app wants a keypad,
        // so the default belongs here rather than being remembered at each of the dozen call sites
        // that had already forgotten it.
        //
        // step="1" means whole numbers, so that gets the keypad without a decimal point — there is
        // nothing useful to type with it. Anything else may take a fraction. An explicit inputMode
        // from the caller always wins.
        inputMode={
          props.inputMode ??
          (props.type === "number" ? (props.step === "1" ? "numeric" : "decimal") : undefined)
        }
        onChange={
          transform
            ? (event) => {
                capitalizeInPlace(event.currentTarget, transform);
                onChange?.(event);
              }
            : onChange
        }
        className={`rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 aria-[invalid=true]:border-danger ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

export function Textarea({ label, error, id, className = "", autoCapitalize, onChange, ...props }: TextareaProps) {
  // Sentences here: a note or an address runs to several words, and title case over a paragraph
  // reads as a headline.
  const transform = resolveTransform(autoCapitalize, undefined, undefined, "sentences");

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={Boolean(error)}
        autoCapitalize={autoCapitalize ?? (transform ? "sentences" : undefined)}
        onChange={
          transform
            ? (event) => {
                capitalizeInPlace(event.currentTarget, transform);
                onChange?.(event);
              }
            : onChange
        }
        className={`rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 aria-[invalid=true]:border-danger ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
