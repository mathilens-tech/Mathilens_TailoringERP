"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A date entered as three separate choices — day, month, year — each opening a grid that shows
 * every option at once.
 *
 * WHY NOT THE NATIVE PICKER (see DateInput, which is still what order dates use). A calendar is
 * the right control for "which day next week", and the wrong one for a date of birth: it opens on
 * this month, and reaching 1985 means thirty-odd taps on a back arrow, or discovering that the
 * month caption is itself a button. At the counter that is the step where staff give up and leave
 * the field empty.
 *
 * So: a day is one tap out of 31 on screen together, a month is one tap out of 12, and a year is
 * one tap out of the recent ten, with the full list a tap further for the years that need it.
 * Nothing here needs the operator to already know how the control works.
 */

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** How many years the grid offers before the full list has to be opened. */
const RECENT_YEARS = 10;
/** Far enough back to cover any customer's date of birth. */
const EARLIEST_YEAR_OFFSET = 100;

type Part = "day" | "month" | "year";

type Parts = { day: string; month: string; year: string };

const EMPTY: Parts = { day: "", month: "", year: "" };

function splitIso(isoDate: string): Parts {
  const [year, month, day] = (isoDate ?? "").split("-");
  return year && month && day ? { day, month, year } : EMPTY;
}

/**
 * Days in the chosen month. An unknown year is treated as a leap year so 29 February is offered
 * before the year has been picked — the alternative hides a day that is about to become valid.
 */
function daysInMonth(year: string, month: string): number {
  if (!month) {
    return 31;
  }
  return new Date(Number(year || "2024"), Number(month), 0).getDate();
}

/** ISO `yyyy-MM-dd`, or "" while the date is still incomplete — which is what an empty field is. */
function compose(parts: Parts): string {
  if (!parts.day || !parts.month || !parts.year) {
    return "";
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Deliberately tighter than a text field: three of these sit on one line inside a dialog, so the
// padding a single input can afford is width the group does not have.
const triggerClassName =
  "flex w-full items-center justify-between gap-0.5 rounded-md border border-border bg-surface px-2 py-1.5 text-sm leading-tight outline-none transition-colors hover:border-foreground/25 focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60";

// h-8 rather than padding alone, so 31 days come out as five even rows instead of five rows whose
// height depends on whether the number inside is one digit or two.
const optionClassName =
  "flex h-8 items-center justify-center rounded-md text-sm transition-colors hover:bg-surface-hover aria-[current=true]:bg-primary aria-[current=true]:font-medium aria-[current=true]:text-primary-foreground";

export function DatePartsInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
  className = "",
}: {
  id: string;
  label: string;
  /** ISO `yyyy-MM-dd`, as the API speaks. */
  value: string;
  /** Receives ISO `yyyy-MM-dd`, or "" while any of the three is still unanswered. */
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [parts, setParts] = useState<Parts>(() => splitIso(value));
  const [lastValue, setLastValue] = useState(value);
  const [open, setOpen] = useState<Part | null>(null);
  const [showAllYears, setShowAllYears] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Follows the field being reset or re-seeded from outside. Adjusted during the render that
  // brings the new prop in rather than in an effect, which would paint the stale date first.
  // A half-filled date composes to "" — already what the caller holds — so a day chosen before a
  // month does not get wiped by this on the way back through.
  if (value !== lastValue) {
    setLastValue(value);
    if (compose(parts) !== value) {
      setParts(splitIso(value));
    }
  }

  // A grid left open behind the operator's next tap is the thing that makes a popover feel stuck.
  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // Stopped here so Escape closes the grid rather than the dialog the field sits in.
        event.stopPropagation();
        setOpen(null);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  function toggle(part: Part) {
    if (disabled) {
      return;
    }
    setShowAllYears(false);
    setOpen((current) => (current === part ? null : part));
  }

  function choose(part: Part, chosen: string) {
    const next: Parts = { ...parts, [part]: chosen };

    // 31 chosen, then February: the day is pulled back to the last one that month has rather than
    // silently composing a date that does not exist.
    const limit = daysInMonth(next.year, next.month);
    if (next.day && Number(next.day) > limit) {
      next.day = String(limit).padStart(2, "0");
    }

    setParts(next);
    setOpen(null);
    onChange(compose(next));
  }

  function clear() {
    setParts(EMPTY);
    setOpen(null);
    onChange("");
  }

  const currentYear = new Date().getFullYear();
  const years = showAllYears
    ? Array.from({ length: EARLIEST_YEAR_OFFSET + 1 }, (_, i) => currentYear - i)
    : Array.from({ length: RECENT_YEARS }, (_, i) => currentYear - i);
  const days = Array.from({ length: daysInMonth(parts.year, parts.month) }, (_, i) => i + 1);
  const hasAnyPart = parts.day !== "" || parts.month !== "" || parts.year !== "";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
      </span>

      <div
        ref={containerRef}
        role="group"
        aria-labelledby={`${id}-label`}
        className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-1"
      >
        {/* Day */}
        <div className="relative">
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-haspopup="true"
            aria-expanded={open === "day"}
            aria-label={`${label} — day`}
            onClick={() => toggle("day")}
            className={triggerClassName}
          >
            <span className={parts.day ? "" : "text-foreground/50"}>{parts.day || "DD"}</span>
            <Chevron />
          </button>
          {open === "day" && (
            <Panel align="left" className="w-[14.5rem]">
              <div className="grid grid-cols-7 gap-px">
                {days.map((day) => {
                  const padded = String(day).padStart(2, "0");
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-current={parts.day === padded}
                      onClick={() => choose("day", padded)}
                      className={optionClassName}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>

        {/* Month */}
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            aria-haspopup="true"
            aria-expanded={open === "month"}
            aria-label={`${label} — month`}
            onClick={() => toggle("month")}
            className={triggerClassName}
          >
            <span className={parts.month ? "" : "text-foreground/50"}>
              {parts.month ? MONTH_LABELS[Number(parts.month) - 1] : "MMM"}
            </span>
            <Chevron />
          </button>
          {open === "month" && (
            <Panel align="left" className="w-[11.5rem]">
              <div className="grid grid-cols-3 gap-px">
                {MONTH_LABELS.map((month, index) => {
                  const padded = String(index + 1).padStart(2, "0");
                  return (
                    <button
                      key={month}
                      type="button"
                      title={MONTH_NAMES[index]}
                      aria-current={parts.month === padded}
                      onClick={() => choose("month", padded)}
                      className={optionClassName}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>

        {/* Year */}
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            aria-haspopup="true"
            aria-expanded={open === "year"}
            aria-label={`${label} — year`}
            onClick={() => toggle("year")}
            className={triggerClassName}
          >
            <span className={parts.year ? "" : "text-foreground/50"}>{parts.year || "YYYY"}</span>
            <Chevron />
          </button>
          {open === "year" && (
            <Panel align="right" className="w-[12.5rem]">
              {/* The recent ten cover a wedding date and an anniversary; a date of birth is the
                  reason the full list is one tap away rather than the thing on screen first. */}
              <div className={`grid grid-cols-3 gap-px ${showAllYears ? "max-h-48 overflow-y-auto" : ""}`}>
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    aria-current={parts.year === String(year)}
                    onClick={() => choose("year", String(year))}
                    className={optionClassName}
                  >
                    {year}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAllYears((shown) => !shown)}
                className="mt-1 w-full rounded-md border-t border-border pt-1.5 text-xs font-medium text-primary hover:underline"
              >
                {showAllYears ? "Recent years" : "Earlier years…"}
              </button>
            </Panel>
          )}
        </div>

        {/* Every one of these dates is optional, so there has to be a way back out of one entered
            by mistake — the grids themselves only ever set a value. */}
        {hasAnyPart && !disabled && (
          <button
            type="button"
            onClick={clear}
            aria-label={`Clear ${label}`}
            title={`Clear ${label}`}
            className="rounded-md p-1 text-foreground/45 transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function Panel({
  align,
  className = "",
  children,
}: {
  align: "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  // Anchored to whichever edge keeps it on screen: the day and month grids open rightwards from
  // the left of the field, the year grid leftwards from the right of it.
  return (
    <div
      className={`absolute top-full z-30 mt-1 max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-1 shadow-lg ring-1 ring-black/5 ${
        align === "left" ? "left-0" : "right-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-foreground/40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
