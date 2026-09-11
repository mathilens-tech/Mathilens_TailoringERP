"use client";

import { useRef, type KeyboardEvent } from "react";
import { toDisplayDate } from "@/lib/date";

/** The field styling every date box on the dashboard already used, kept identical. */
const fieldClassName =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60";

type DateInputProps = {
  id: string;
  /** ISO `yyyy-MM-dd`, as the API and `<input type="date">` both speak. */
  value: string;
  /** Receives ISO `yyyy-MM-dd`, or "" when cleared. */
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
  /**
   * Sizing for the field as a whole — it lands on the wrapper, not the input.
   *
   * The input is w-full inside it, so a width passed here is not competing with that: two width
   * classes on one element resolve by stylesheet order, not by the order they are written in.
   */
  className?: string;
  /** Only where the caller has no <label htmlFor> of its own. */
  "aria-label"?: string;
};

/**
 * A date field that reads DD-MM-YYYY and opens the calendar wherever you click it.
 *
 * TWO PROBLEMS WITH A BARE `<input type="date">`, both of which this solves.
 *
 * *Format*: it renders in the browser's own locale — mm/dd/yyyy on a machine set to en-US — and
 * nothing in HTML changes that. `lang` is ignored, and there is no format attribute. The shop
 * reads dates as DD-MM-YYYY, so the visible field here is an ordinary text input we format
 * ourselves, and the real date input is kept behind it purely for its picker.
 *
 * *Opening*: clicking the middle of a native date input puts the caret in a segment; only the
 * little calendar glyph opens the picker, which is a target most people never find. Here a click
 * anywhere on the field opens it.
 *
 * The visible field is read-only on purpose: the click that opens the picker also takes focus off
 * it, so a caret that can be placed but never typed into would be worse than a field that plainly
 * belongs to the picker. Enter and Space open it too, so it stays reachable without a mouse.
 */
export function DateInput({
  id,
  value,
  onChange,
  disabled,
  min,
  max,
  className = "",
  "aria-label": ariaLabel,
}: DateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    if (disabled) {
      return;
    }
    // Optional-called: showPicker is unsupported on older Safari, where the field still works —
    // it simply falls back to the native input's own behaviour rather than throwing.
    pickerRef.current?.showPicker?.();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD-MM-YYYY"
        aria-label={ariaLabel}
        value={toDisplayDate(value)}
        disabled={disabled}
        readOnly
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        className={`${fieldClassName} w-full cursor-pointer`}
      />
      {/*
        Invisible, not hidden: showPicker throws on an element that is not being rendered, and
        `display: none` or `hidden` would make this exactly that. Laid over the text field so the
        calendar opens against the box the user actually clicked, and pointer-events-none so the
        click lands on the text field above rather than on a native segment underneath.
      */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </div>
  );
}
