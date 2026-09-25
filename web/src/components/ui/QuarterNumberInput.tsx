"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A figure entered as a whole number and a quarter, with an optional pad for the whole part.
 *
 * <p>Shared by the measurement fields and the item rows' Metres box, because both are the same
 * problem: a tape and a cloth counter are both read in quarters, and both were plain decimal boxes
 * that invited someone to type 40.5 and then a second person to read it back as "forty point five"
 * and convert. Picking the fraction says it in the units the shop works in.</p>
 *
 * <p><b>Nothing about storage changes.</b> Whole 40 and quarter ¼ are summed and handed to the
 * caller as <c>"40.25"</c> — the same string the plain box produced. This is a way of entering a
 * decimal, not a new kind of one, so every reader of the saved value is untouched.</p>
 */

/** The quarters a tape or a cloth counter is actually read to. */
const FRACTIONS = [
  { value: 0, label: "—" },
  { value: 0.25, label: "¼" },
  { value: 0.5, label: "½" },
  { value: 0.75, label: "¾" },
] as const;

/**
 * The most values the pad will lay out.
 *
 * <p>Past a point a grid of buttons is slower to use than typing, and rendering hundreds of them
 * for a control tapped once is waste. Beyond this the pad is simply not offered — the box still
 * takes anything typed, so nothing becomes unreachable.</p>
 */
const MAX_PAD_VALUES = 120;

/**
 * Splits a stored figure into its whole number and the quarter beside it.
 *
 * <p>A figure that is not on a quarter — 35.34, typed before this control existed or imported from
 * elsewhere — is reported as such so the caller can leave it in a plain box rather than rounding
 * somebody's measurement to make it fit.</p>
 */
export function splitFigure(text: string): { whole: string; fraction: number; isOnQuarter: boolean } {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { whole: "", fraction: 0, isOnQuarter: true };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return { whole: trimmed, fraction: 0, isOnQuarter: false };
  }

  const whole = Math.floor(parsed);
  const remainder = Number((parsed - whole).toFixed(4));
  const isOnQuarter = FRACTIONS.some((f) => f.value === remainder);

  return { whole: String(whole), fraction: isOnQuarter ? remainder : 0, isOnQuarter };
}

/**
 * Puts a whole number and a fraction back together.
 *
 * <p>Rounded to two places because floating point applies to quarters too: 40 + 0.75 can land on
 * 40.750000000000004, and that is what would be stored and then printed on an invoice.</p>
 */
export function joinFigure(whole: string, fraction: number): string {
  const trimmed = whole.trim();
  if (trimmed === "") {
    // A fraction with no whole number in front of it is half an answer, but it is kept rather than
    // discarded so the dropdown does not silently reset itself while somebody is mid-entry.
    return fraction === 0 ? "" : String(fraction);
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return trimmed;
  }

  return String(Number((Math.trunc(parsed) + fraction).toFixed(2)));
}

export function QuarterNumberInput({
  id,
  value,
  onChange,
  disabled = false,
  padMin,
  padMax,
  ariaLabel,
  className = "",
  placeholder,
  entryMode = "type",
  allowFraction = true,
}: {
  id?: string;
  /** The whole figure, as text — "40.25". */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Bounds of the whole-number pad. Omit either and no pad is offered, only typing. */
  padMin?: number;
  padMax?: number;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
  /**
   * How the whole number is chosen.
   *
   * <p>"type" is an ordinary box with the pad as a shortcut beside it. "pad" makes the box itself
   * open the pad and stops it taking keystrokes — for a field whose answer is nearly always one of
   * a handful of values, where a keyboard covering half a tablet to type a single digit is the
   * slower path and the easier one to mistype.</p>
   *
   * <p>Typing is still reachable in "pad": the pad carries a Type button that hands the box back.
   * A control with no way in at all would be one a shop could not record an unusual figure in, and
   * the unusual figure is exactly what nobody can anticipate.</p>
   */
  entryMode?: "type" | "pad";
  /**
   * Whether a quarter may be added to the whole number.
   *
   * <p>False for a count of things. There is no half a shirt, and offering the row anyway would put
   * four buttons under the pad that must never be pressed — the sort of control that looks like a
   * feature until somebody uses it and produces an order for 2½ trousers.</p>
   */
  allowFraction?: boolean;
}) {
  const [isPadOpen, setIsPadOpen] = useState(false);
  /** Set by the pad's Type button, so an unusual figure is still reachable in pad mode. */
  const [isTyping, setIsTyping] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);

  /**
   * Which edge the pad hangs from.
   *
   * <p>It was always right-aligned, which means it opens leftwards — fine for a field near the
   * right of the screen, and wrong for one on the left, where the pad ran off the edge and was
   * clipped. The measurement panel puts fields in two columns, so half of them were the wrong
   * half.</p>
   *
   * <p>Measured when the pad opens rather than guessed from a breakpoint: the same field sits in
   * different places on a phone, a tablet and the order screen's second column, and only the
   * element itself knows where it currently is.</p>
   */
  const [padSide, setPadSide] = useState<"left" | "right">("left");

  const split = useMemo(() => splitFigure(value), [value]);
  /**
   * Whether the quarters are on offer at all.
   *
   * <p>Not where the caller has said this figure is whole, and not for a value already off the
   * quarters — a 35.34 recorded before this control existed keeps a plain box, so the control
   * cannot round somebody's measurement away to make it fit.</p>
   */
  const usesFraction = allowFraction && split.isOnQuarter;

  const padValues = useMemo(() => {
    if (padMin === undefined || padMax === undefined) {
      return [];
    }
    const from = Math.ceil(padMin);
    const to = Math.floor(padMax);
    const count = to - from + 1;
    return count <= 0 || count > MAX_PAD_VALUES ? [] : Array.from({ length: count }, (_, i) => from + i);
  }, [padMin, padMax]);

  const offersPad = !disabled && padValues.length > 0;
  /**
   * Whether the box refuses keystrokes and opens the pad instead.
   *
   * <p>Only where there is a pad to open. A "pad" field whose range is missing or too wide to lay
   * out would otherwise be a box that cannot be typed in and has nothing to choose from — which is
   * a field nobody can answer.</p>
   */
  const isPadDriven = entryMode === "pad" && offersPad && !isTyping;

  /**
   * Whether the quarter is picked in a control of its own, beside the box.
   *
   * <p>Only when there is no pad to put it in. This is what decides what the box itself shows: with
   * a separate fraction control the box holds the whole number and the two are read together, but
   * with the quarters inside the pad the box is the only thing on screen — so it has to show the
   * whole figure.</p>
   *
   * <p>Getting this wrong is what made picking ½ look like it had done nothing: the fraction was
   * stored, and the box went on displaying the whole part of it.</p>
   */
  const fractionBesideBox = usesFraction && !offersPad;

  useEffect(() => {
    if (!isPadOpen) {
      return;
    }

    /*
      Hang the pad from whichever edge keeps it on screen.

      PAD_WIDTH mirrors the w-64 below. Measuring the pad itself would be more honest but needs it
      rendered first, which means a frame where it is in the wrong place — and on a phone that shows
      as a visible jump.

      Left by default, flipping right only when the pad would run past the viewport. Anchoring right
      shifts it left by its own width, which is what keeps it inside the screen for a field near the
      right-hand edge.
    */
    const PAD_WIDTH = 256;
    const left = fieldRef.current?.getBoundingClientRect().left ?? 0;
    setPadSide(left + PAD_WIDTH > window.innerWidth - 8 ? "right" : "left");
    // mousedown rather than click, so the pad is gone before whatever is underneath it receives
    // its own event.
    function handleOutsideClick(event: MouseEvent) {
      if (!fieldRef.current?.contains(event.target as Node)) {
        setIsPadOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isPadOpen]);

  return (
    <div ref={fieldRef} className={`relative flex items-center gap-1.5 ${className}`}>
      <input
        id={id}
        aria-label={ariaLabel}
        type="number"
        // A whole-number box while the fraction is picked beside it, so the two controls cannot
        // both offer a decimal and disagree about it.
        // Whole numbers only while a separate control owns the fraction, so the two cannot both
        // offer a decimal and disagree. Otherwise the box holds the whole figure and takes one.
        step={fractionBesideBox || !allowFraction ? "1" : "any"}
        min="0"
        inputMode={fractionBesideBox || !allowFraction ? "numeric" : "decimal"}
        placeholder={placeholder}
        value={fractionBesideBox ? split.whole : value}
        disabled={disabled}
        // readOnly rather than disabled: the value still submits, the box still takes focus and is
        // still announced, and only editing is refused. disabled would grey it out and drop it from
        // the tab order, which is a different and much stronger statement than "choose from the pad".
        readOnly={isPadDriven}
        // Typing a whole number clears the quarter, for the reason the pad's own numbers do: this
        // box previously re-applied the stored fraction to whatever was typed, so correcting 27.5
        // to 28 by typing 28 gave back 28.5. The quarter is chosen beside the box, after the
        // number, and is never carried over from the figure being replaced.
        //
        // Only where the fraction lives elsewhere. When the box holds the whole figure, what was
        // typed is the figure — running it through joinFigure would truncate a typed 5.5 back to 5.
        onChange={(e) => onChange(fractionBesideBox ? joinFigure(e.target.value, 0) : e.target.value)}
        onClick={() => {
          if (isPadDriven) {
            setIsPadOpen(true);
          }
        }}
        onKeyDown={(e) => {
          // Enter would submit the form this sits inside.
          if (e.key === "Enter") e.preventDefault();
          // The pad is reachable from the keyboard too, so this is not a mouse-only control.
          if (isPadDriven && (e.key === " " || e.key === "Enter")) {
            e.preventDefault();
            setIsPadOpen(true);
          }
        }}
        className={`w-16 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-foreground/50 ${
          isPadDriven ? "cursor-pointer caret-transparent" : ""
        }`}
      />

      {/* No opener in pad mode: the box itself opens the pad, so an icon beside it would be a
          second control for the job the field is already doing — and the one place it could be
          pressed by mistake while reaching for the value.

          Kept in type mode, where it is the only way in. There the box takes keystrokes, so
          clicking it cannot also mean "open the pad" without stealing the click from typing. */}
      {offersPad && entryMode === "type" && (
        <button
          type="button"
          onClick={() => setIsPadOpen((open) => !open)}
          aria-expanded={isPadOpen}
          aria-label={`${ariaLabel}: choose from ${padMin} to ${padMax}`}
          title={`${padMin}–${padMax}`}
          className="shrink-0 rounded-md border border-border p-1.5 text-foreground/60 transition-colors hover:border-primary hover:text-primary"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 3v18" />
          </svg>
        </button>
      )}

      {/* The quarter, as a dropdown, only where there is no pad to put it in.

          A field with a pad carries its fractions inside it as buttons — one control, tapped once,
          rather than a grid and a dropdown side by side both belonging to the same figure. A field
          without a pad has nowhere to put them, and a select is the narrower of the two ways to
          offer four choices in a row that already holds a label and a box. */}
      {fractionBesideBox && (
        <select
          aria-label={`${ariaLabel} fraction`}
          value={String(split.fraction)}
          disabled={disabled}
          onChange={(e) => onChange(joinFigure(split.whole, Number(e.target.value)))}
          className="w-14 shrink-0 rounded-md border border-border bg-surface px-1 py-1.5 text-center text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-foreground/50"
        >
          {FRACTIONS.map((fraction) => (
            <option key={fraction.value} value={String(fraction.value)}>
              {fraction.label}
            </option>
          ))}
        </select>
      )}

      {offersPad && isPadOpen && (
        /*
          Laid out to be short rather than wide-and-tall.

          Five numbers to a row instead of four, so a 1–20 range is four rows rather than five and
          fits without scrolling. The running total sits in the header where the range used to be
          spelled out — "1–20" was reference material that never changed, while the figure being
          built changes on every tap and is the one thing worth watching. And the quarters share a
          line with Done instead of each taking one of their own.

          The whole pad is about a third shorter than the stacked version, which on a phone is the
          difference between covering the item row underneath and sitting beside it.
        */
        <div
          className={`absolute top-full z-20 mt-1 w-64 rounded-md border border-border bg-surface p-2 shadow-lg ${
            padSide === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
            <span className="text-sm font-semibold tabular-nums">
              {value === "" ? <span className="font-normal text-foreground/40">Pick a value</span> : value}
            </span>
            <div className="flex items-center gap-1">
              {/* The way to a figure the pad does not carry — a 40 metre roll, or a length between
                  the steps. Without it a pad-driven box would be a field a shop simply could not
                  record an unusual value in, and the unusual value is the one nobody can plan for. */}
              {entryMode === "pad" && (
                <button
                  type="button"
                  onClick={() => {
                    setIsTyping(true);
                    setIsPadOpen(false);
                  }}
                  className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground/70 transition-colors hover:border-primary hover:text-primary"
                >
                  Type
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsPadOpen(false);
                }}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground/70 transition-colors hover:border-danger hover:text-danger"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid max-h-44 grid-cols-5 gap-1 overflow-y-auto">
            {padValues.map((candidate) => (
              <button
                key={candidate}
                type="button"
                // Clears whatever quarter was showing. This used to keep it, so that tapping 5
                // after ½ gave 5.5 and saved a tap — but it also meant correcting 27.5 to 28 by
                // tapping 28 produced 28.5. Somebody fixing a measurement watched the figure they
                // had just rejected reattach itself to the new number, and a quarter inch nobody
                // chose is a garment cut wrong.
                //
                // Picking a number is therefore the start of a figure, not an edit to part of one:
                // the quarters sit below and are pressed after it, which is the order they are read
                // in anyway. The saved tap was worth less than being able to trust the box.
                //
                // Closes only where there is nothing else in the pad to choose. With quarters on
                // offer the number is half the answer, and closing on it would dismiss them before
                // they could be reached. Done closes instead.
                onClick={() => {
                  onChange(joinFigure(String(candidate), 0));
                  if (!usesFraction) {
                    setIsPadOpen(false);
                  }
                }}
                className={`rounded py-1.5 text-sm tabular-nums transition-colors ${
                  split.whole === String(candidate)
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-surface-hover"
                }`}
              >
                {candidate}
              </button>
            ))}
          </div>

          {/* Quarters and Done on one line. The quarters are four small, fixed choices and Done is
              pressed straight after them, so a row each was two rows spent on one gesture. */}
          {usesFraction && (
            <div className="mt-1.5 flex items-center gap-1 border-t border-border pt-1.5">
              {FRACTIONS.map((fraction) => (
                <button
                  key={fraction.value}
                  type="button"
                  aria-label={fraction.value === 0 ? "No fraction" : `Plus ${fraction.label}`}
                  onClick={() => onChange(joinFigure(split.whole, fraction.value))}
                  className={`flex-1 rounded py-1.5 text-base leading-none transition-colors ${
                    split.fraction === fraction.value
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:bg-surface-hover"
                  }`}
                >
                  {fraction.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsPadOpen(false)}
                className="ml-1 shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
