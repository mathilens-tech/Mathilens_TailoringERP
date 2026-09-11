"use client";

import type { MeasurementPoint, MeasurementValue } from "@/lib/api/measurements";

/**
 * One measurement point, rendered as whatever it asks for: a figure, a tick, or a word.
 *
 * <p>Form state is kept as text for all three — "40", "true", "open" — rather than as a union. A
 * number field passes through "" and "12." on its way to a value, a checkbox is only ever on or
 * off, and keeping one shape means the panel's state, its reset and its seeding are each written
 * once instead of three times. {@link toMeasurementValue} does the conversion at the one point it
 * matters, which is saving.</p>
 */
export function MeasurementPointInput({
  point,
  value,
  onChange,
  disabled = false,
}: {
  point: MeasurementPoint;
  /** Always text; see the note above. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  if (point.type === "Checkbox") {
    return (
      <label className="flex items-center gap-3 py-0.5">
        <input
          type="checkbox"
          checked={value === "true"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          className="h-4 w-4 shrink-0 accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        {/* The name is the label here rather than a column beside the control: a tick reads as
            "this garment has a side pocket", which is a sentence, not a field and a figure. */}
        <span className="min-w-0 text-sm text-foreground/80">{point.name}</span>
      </label>
    );
  }

  const isText = point.type === "Text";

  return (
    <div className="flex items-center gap-3">
      <label htmlFor={`point-${point.name}`} className="w-32 shrink-0 text-sm text-foreground/80">
        {point.name}
      </label>
      <input
        id={`point-${point.name}`}
        aria-label={`${point.name} ${isText ? "value" : "measurement value"}`}
        // Text points hold a style name, so they take no step, no minimum and no numeric keypad.
        type={isText ? "text" : "number"}
        {...(isText ? {} : { step: "0.1", min: "0" })}
        placeholder={isText ? "" : "cm"}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter would submit the order form from inside the measurement panel.
          if (e.key === "Enter") e.preventDefault();
        }}
        className={`${isText ? "w-32" : "w-24"} rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-foreground/50`}
      />
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
