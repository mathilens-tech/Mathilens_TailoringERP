"use client";

import { QuarterNumberInput } from "@/components/ui/QuarterNumberInput";
import {
  allowsDecimals,
  hasRange,
  hasSecondValue,
  type MeasurementPoint,
  type MeasurementValue,
} from "@/lib/api/measurements";
import { useOrderEntrySettings } from "@/lib/use-order-entry-settings";

/**
 * One measurement point, rendered as whatever it asks for: a figure, a tick, or a word.
 *
 * <p>Form state is kept as text for all three — "40", "true", "open" — rather than as a union. A
 * number field passes through "" and "12." on its way to a value, a checkbox is only ever on or
 * off, and keeping one shape means the panel's state, its reset and its seeding are each written
 * once instead of three times. {@link toMeasurementValue} does the conversion at the one point it
 * matters, which is saving.</p>
 *
 * <p>A figure is entered through {@link QuarterNumberInput} — a whole number, a quarter beside it,
 * and a pad for the whole part when the point has a range. That control is shared with the item
 * rows' Metres box: a tape and a cloth counter are read the same way, and both were plain decimal
 * boxes that made somebody convert quarters in their head.</p>
 */
export function MeasurementPointInput({
  point,
  value,
  onChange,
  secondValue = "",
  onSecondChange,
  disabled = false,
}: {
  point: MeasurementPoint;
  /** Always text; see the note above. */
  value: string;
  onChange: (value: string) => void;
  /**
   * The second figure, when the point takes two.
   *
   * <p>Held by the caller under the second box's own label, because that is where it is saved —
   * the two are ordinary entries in the values map, tied together by the template rather than by
   * the shape of what is stored.</p>
   */
  secondValue?: string;
  onSecondChange?: (value: string) => void;
  disabled?: boolean;
}) {
  // Above the early returns below, because a hook cannot be conditional. A tick or a word never
  // reads this, and pays nothing for it: the settings are fetched once for the whole app and every
  // caller after the first is handed the cached answer.
  const entrySettings = useOrderEntrySettings();

  if (point.type === "Checkbox") {
    return (
      // -mx-1 px-1 py-1.5 rather than py-0.5: the box itself is 20px, and a tap that lands a few
      // pixels off it should still register. The negative margin keeps the row aligned with the
      // fields above and below despite the added padding, so the column does not step in and out.
      //
      // cursor-pointer because the whole row is the target — a label wrapping its input forwards
      // the click, so the name is as tappable as the box.
      <label className="-mx-1 flex cursor-pointer items-center gap-3 rounded px-1 py-1.5 transition-colors hover:bg-surface-hover">
        <input
          type="checkbox"
          checked={value === "true"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          className="h-5 w-5 shrink-0 accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        {/* The name is the label here rather than a column beside the control: a tick reads as
            "this garment has a side pocket", which is a sentence, not a field and a figure. */}
        <span className="min-w-0 text-sm text-foreground/80">{point.name}</span>
      </label>
    );
  }

  if (point.type === "Text") {
    return (
      <FieldShell label={point.name} htmlFor={`point-${point.name}`}>
        <input
          id={`point-${point.name}`}
          aria-label={`${point.name} value`}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter would submit the order form from inside the measurement panel.
            if (e.key === "Enter") e.preventDefault();
          }}
          className="w-32 rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-foreground/50"
        />
      </FieldShell>
    );
  }

  // The pad's bounds: this point's own range where the shop set one, and the shop-wide measurement
  // range otherwise.
  //
  // Falling back rather than leaving the pad off is what makes every numeric point behave the same
  // way. Only a handful of points are worth giving a tight range of their own, and without a
  // fallback the rest kept a typed box — so the same panel mixed two ways of entering a figure
  // depending on settings nobody had visited.
  const range = hasRange(point)
    ? { min: point.min as number, max: point.max as number }
    : entrySettings.measurement;
  const secondLabel = (point.secondName ?? "").trim();

  return (
    /*
      Both figures on one line, under the point's name, separated by a comma.

      They were two rows, the second indented and carrying its own label. That read as two
      questions: the name of the point sat against the first box only, so the second looked like a
      separate point that happened to follow it — which is exactly what this feature exists to stop.
      One row, one name, and a comma between them says what it is: one measurement taken twice.

      It also matches how the pair reads everywhere else — the order screen, the customer record and
      the history all show "40, 42" under one heading.

      The second box is never required. A point can be answered with one figure and left there;
      nothing validates the pair as a unit, and an empty second box simply is not saved.
    */
    <FieldShell label={point.name} htmlFor={`point-${point.name}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <QuarterNumberInput
          id={`point-${point.name}`}
          ariaLabel={point.name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          padMin={range.min}
          padMax={range.max}
          // The same behaviour as the item rows' Metres box: tapping opens the pad rather than a
          // keyboard, and the quarters are in the pad with the whole numbers. Every numeric point
          // has a pad now — its own range, or the shop-wide one.
          entryMode="pad"
          // A point the shop restricted to whole numbers gets no quarter to pick. The control reads
          // this from the value it is given, so handing it a whole number is what keeps it whole.
          placeholder={allowsDecimals(point) ? "" : "cm"}
        />

        {hasSecondValue(point) && onSecondChange && (
          <>
            <span aria-hidden="true" className="shrink-0 text-sm text-foreground/50">
              ,
            </span>
            {/* Its label lives on the control rather than on screen: the comma already says this is
                the same measurement's second figure, and a second heading on the line would undo
                the joining. A screen reader still hears the name the shop gave it. */}
            <QuarterNumberInput
              id={`point-${secondLabel}`}
              ariaLabel={secondLabel}
              value={secondValue}
              onChange={onSecondChange}
              disabled={disabled}
              padMin={range.min}
              padMax={range.max}
              entryMode="pad"
              placeholder={allowsDecimals(point) ? "" : "cm"}
            />
          </>
        )}
      </div>
    </FieldShell>
  );
}

/**
 * The label beside a field.
 *
 * <p>w-28 and truncating rather than w-32 with room to wrap: a point named "Bottom round" took two
 * lines at the wider size inside the order screen's narrower right-hand column, which made some
 * rows twice the height of their neighbours and the panel far longer than its field count
 * suggested. The full name stays available on hover and to a screen reader.</p>
 */
function FieldShell({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={htmlFor} title={label} className="w-28 shrink-0 truncate text-sm text-foreground/80">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * The text a field holds, as the value that should be saved — or null for "nothing to record".
 *
 * <p>Numbers and words are skipped when blank: a point nobody has measured yet should not be
 * stored as zero or as an empty string. A checkbox is never skipped, because "no" is an answer —
 * "this trouser has no cross pocket" is something the tailor decided, not something left undone.</p>
 */
export function toMeasurementValue(point: MeasurementPoint, raw: string): MeasurementValue | null {
  if (point.type === "Checkbox") {
    return raw === "true";
  }

  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }

  if (point.type === "Text") {
    return trimmed;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

/** What a saved value looks like back in the form. Booleans become "true"/"false" to match above. */
export function toFieldText(value: MeasurementValue | undefined): string {
  return value === undefined ? "" : String(value);
}
