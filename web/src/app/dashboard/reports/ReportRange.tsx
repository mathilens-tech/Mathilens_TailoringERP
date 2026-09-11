"use client";

import { useState } from "react";
import { DateInput } from "@/components/ui/DateInput";

/**
 * Far enough back to predate any record the shop holds, so "All" needs no special case downstream.
 *
 * The reports take a required from-and-to; a sentinel keeps that contract intact rather than making
 * both ends nullable through the query, the handler and the export for the sake of one option.
 */
export const ALL_TIME_FROM = "1900-01-01";

/**
 * Ranges the shop actually thinks in — everything at the top, then day-to-day operations at the
 * short end and season-over-season comparison at the long end.
 *
 * Every one of them lives in the dropdown. They were a row of chips beside a permanently visible
 * From/To pair, which put three ways of saying the same thing on screen at once and let the chips
 * and the boxes disagree about the period being shown.
 */
export const RANGE_PRESETS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "Last 7 Days", days: 7 },
  { key: "30d", label: "Last 30 Days", days: 30 },
  { key: "3m", label: "Last 3 Months", months: 3 },
  { key: "6m", label: "Last 6 Months", months: 6 },
  { key: "9m", label: "Last 9 Months", months: 9 },
  { key: "1y", label: "Last 1 Year", months: 12 },
] as const;

/**
 * The three the counter asks for by name, put within one tap of the screen opening.
 *
 * They are shortcuts into the dropdown beside them, not a second control: both write the same
 * selection, so whichever is used, the other shows it. The remaining windows stay in the dropdown
 * alone — a row of eight buttons is the chip row this replaced.
 */
const QUICK_PRESETS = ["today", "7d", "30d"] as const;

/**
 * What the three shortcuts read on a phone.
 *
 * "Last" is what gets dropped, because it is the word carrying least: sitting under a control
 * labelled Filter, "30 Days" is not open to a second reading. Losing it is what lets the dropdown
 * and all three buttons share one row on a 360px screen — the full labels need about 100px more
 * than such a screen has, and a row that wraps puts one shortcut on a line of its own.
 */
const QUICK_PRESET_SHORT_LABELS: Record<(typeof QUICK_PRESETS)[number], string> = {
  today: "Today",
  "7d": "7 Days",
  "30d": "30 Days",
};

/** The windows that know their own dates — everything except Custom, which is told them. */
export type PresetOptionKey = (typeof RANGE_PRESETS)[number]["key"];
export type PresetKey = PresetOptionKey | "custom";

/**
 * Every report opens on the full history. A shop opening Revenue is asking what the business has
 * done, not what the last thirty days did, and a default window quietly leaves figures out of a
 * total nobody was told was windowed. Narrowing is one click away; noticing that a number was
 * already narrowed is not.
 */
export const DEFAULT_PRESET: PresetKey = "all";

/** yyyy-MM-dd read off the local calendar — "today" has to mean the shop's today, not UTC's. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Both ends inclusive: "Last 7 days" is today and the six before it, not today minus seven. */
export function presetRange(key: PresetOptionKey): { from: string; to: string } {
  const to = new Date();

  // Handled before the arithmetic because it is the one preset with no length to subtract.
  if (key === "all") {
    return { from: ALL_TIME_FROM, to: toIsoDate(to) };
  }

  const preset = RANGE_PRESETS.find((p) => p.key === key);
  const from = new Date();

  if (preset && "days" in preset) {
    from.setDate(from.getDate() - (preset.days - 1));
  } else if (preset && "months" in preset) {
    // Month arithmetic rolls short months forward (31 Aug − 6 months lands on 2 or 3 Mar);
    // close enough for a report range, and never silently drops days off the end.
    from.setMonth(from.getMonth() - preset.months);
  }

  return { from: toIsoDate(from), to: toIsoDate(to) };
}

/**
 * The picked days as an inclusive UTC instant range. The end of the range has to be the *end* of
 * the To date — sending its midnight excluded everything that happened on the last day, so today's
 * figures never appeared at all.
 */
export function toUtcRange(fromDate: string, toDate: string): { fromUtc: string; toUtc: string } {
  return {
    fromUtc: new Date(`${fromDate}T00:00:00.000Z`).toISOString(),
    toUtc: new Date(`${toDate}T23:59:59.999Z`).toISOString(),
  };
}

/**
 * One figure, with a line saying what it counts.
 *
 * The explanation sits on the tile rather than in a paragraph at the top of the screen. A block of
 * prose above seven numbers has to name each of them before it can describe them, and nobody reads
 * it twice; a line under the number answers the question at the moment it gets asked.
 *
 * justify-between rather than a margin, so those lines sit on a common baseline across the row —
 * the grid already stretches every tile to the tallest, and without it a one-line description
 * floated up under its value while its neighbour's two-line one stayed put.
 */
export function StatTile({ label, value, description }: { label: string; value: string; description?: string }) {
  return (
    <div className="flex h-full flex-col justify-between gap-3 rounded-md border border-border bg-surface p-4">
      <div>
        <div className="text-sm text-foreground/70">{label}</div>
        {/* tabular-nums so the figures line up down the column instead of shifting with the digits. */}
        <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      </div>
      {description && (
        <p className="border-t border-border pt-3 text-xs leading-snug text-foreground/60">{description}</p>
      )}
    </div>
  );
}

export type StatFigure = { label: string; value: string; description?: string };

/**
 * The figures a report is made of — tiles on a wide screen, a table on a phone.
 *
 * A column of tiles read as seven separate boxes to scroll past. The same numbers in a table are one
 * object with a column of values that line up, which is how a shop reads a report on paper. The
 * tiles stay above sm, where a row of them fits and the descriptions have room to sit under each.
 */
export function StatFigures({ figures }: { figures: StatFigure[] }) {
  return (
    <>
      <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {figures.map((figure) => (
          <StatTile key={figure.label} {...figure} />
        ))}
      </div>

      {/* No `stacked` class: this is the phone layout, and turning it back into cards is the thing
          being replaced. Two columns fit 320px without scrolling sideways. */}
      <div className="overflow-hidden rounded-lg border border-border sm:hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-hover">
            <tr>
              <th className="px-3 py-2 font-medium">Figure</th>
              <th className="px-3 py-2 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {figures.map((figure) => (
              <tr key={figure.label} className="border-b border-border last:border-0">
                <td className="px-3 py-2 align-top">
                  <span className="font-medium">{figure.label}</span>
                  {figure.description && (
                    <span className="mt-0.5 block text-xs leading-snug text-foreground/60">{figure.description}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right align-top font-semibold tabular-nums">
                  {figure.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export type ReportRange = ReturnType<typeof useReportRange>;

/**
 * The date range a report screen is showing.
 *
 * Held here rather than in each screen so the three reports cannot drift into describing different
 * periods with the same words — they were one page with one control until they were split apart,
 * and this keeps that guarantee.
 *
 * A named window derives its dates rather than storing them; only Custom keeps a pair, because only
 * Custom has dates that cannot be worked out from the choice. That is what stops the old failure
 * where the chip said "Last 7 days" while the boxes beside it held something else entirely.
 */
export function useReportRange(initial: PresetKey = DEFAULT_PRESET) {
  const [preset, setPreset] = useState<PresetKey>(initial);
  const [customFrom, setCustomFrom] = useState(() => presetRange("today").from);
  const [customTo, setCustomTo] = useState(() => presetRange("today").to);

  const window = preset === "custom" ? { from: customFrom, to: customTo } : presetRange(preset);

  function applyPreset(key: PresetKey) {
    // Switching to Custom seeds the boxes with the window already on screen, so the report does not
    // jump to some unrelated period the moment the option is picked.
    if (key === "custom" && preset !== "custom") {
      setCustomFrom(window.from === ALL_TIME_FROM ? presetRange("30d").from : window.from);
      setCustomTo(window.to);
    }
    setPreset(key);
  }

  return {
    preset,
    fromDate: window.from,
    toDate: window.to,
    applyPreset,
    setCustomFrom,
    setCustomTo,
  };
}

/**
 * One dropdown. The two date boxes belong to Custom alone and appear with it — every other window
 * already knows its own dates, and showing them empty-handed beside a preset was the thing that
 * made the old control ambiguous.
 */
export function ReportRangeFilter({ range }: { range: ReportRange }) {
  const { preset, fromDate, toDate, applyPreset, setCustomFrom, setCustomTo } = range;

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
      {/*
        The dropdown and its three shortcuts, on one line at every width.

        Full width on a phone so the four of them own the row, and w-auto from sm up so the custom
        date boxes can come back alongside. Both the select and the buttons run at the smaller type
        and tighter padding below sm — that, plus the short labels, is what fits four controls into
        the ~328px a 360px screen leaves after the page padding.
      */}
      <div className="flex w-full items-end gap-2 sm:w-auto sm:gap-3">
        <div className="flex shrink-0 flex-col gap-1">
          <label htmlFor="reportRange" className="text-sm font-medium">
            Filter
          </label>
          {/* Sized to its longest option rather than stretching to the container: a full-width box
              on a phone pushed the three shortcuts onto a row of their own, when they belong beside
              the thing they set. */}
          <select
            id="reportRange"
            value={preset}
            onChange={(e) => applyPreset(e.target.value as PresetKey)}
            className="w-28 rounded-md border border-border bg-surface px-2 py-2 text-xs outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 sm:w-40 sm:px-3 sm:text-sm"
          >
            {RANGE_PRESETS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
            <option value="custom">Custom range…</option>
          </select>
        </div>

        {/* Same padding and border as the select, so the row sits on one line rather than stepping. */}
        <div className="flex min-w-0 flex-1 gap-1.5 sm:flex-none sm:gap-2">
          {QUICK_PRESETS.map((key) => {
            const option = RANGE_PRESETS.find((p) => p.key === key)!;
            const isActive = preset === key;
            const base =
              "whitespace-nowrap rounded-md border px-2 py-2 text-xs transition-colors sm:px-3 sm:text-sm";
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                /* aria-pressed, not colour alone — which of the three is on is otherwise carried by
                   nothing a screen reader reads out. */
                aria-pressed={isActive}
                className={
                  isActive
                    ? `${base} border-primary bg-primary font-medium text-white`
                    : `${base} border-border bg-surface text-foreground/70 hover:border-primary hover:text-foreground`
                }
              >
                {/* Two spellings of the same shortcut rather than one that has to serve both: the
                    screen reader gets whichever is rendered, and both say the same thing. */}
                <span className="sm:hidden">{QUICK_PRESET_SHORT_LABELS[key]}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {preset === "custom" && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="fromDate" className="text-sm font-medium">
              From
            </label>
            <DateInput id="fromDate" value={fromDate} max={toDate} onChange={setCustomFrom} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="toDate" className="text-sm font-medium">
              To
            </label>
            <DateInput id="toDate" value={toDate} min={fromDate} onChange={setCustomTo} />
          </div>
        </>
      )}
    </div>
  );
}
