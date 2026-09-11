"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { DateInput } from "@/components/ui/DateInput";
import {
  getShopCalendar,
  saveShopCalendar,
  toIsoDate,
  WEEKDAYS,
  DEFAULT_SHOP_CALENDAR,
  HOLIDAY_NAME_MAX_LENGTH,
  type Holiday,
} from "@/lib/api/shop-calendar";

/** "Sunday, 23 August 2026", assembled by hand so every machine in the shop reads it the same. */
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** 16px text so iOS doesn't zoom the page in when either field takes focus. */
const holidayFieldClassName =
  "min-h-11 w-full rounded-md border border-border bg-surface px-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50";

function formatHoliday(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()].label;
  return `${weekday}, ${day} ${MONTHS[month - 1]} ${year}`;
}

/**
 * The days the shop is shut — the weekly pattern, and the one-off dates.
 *
 * Both feed the collection date a new order is pre-filled with: it rolls forward to the first day
 * the shop is actually open, so a five-day turnaround starting on a Wednesday no longer promises
 * the customer a Sunday.
 */
export default function WorkingDaysSettingsPage() {
  const { showToast } = useToast();
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>(DEFAULT_SHOP_CALENDAR.weeklyOffDays);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const calendar = await getShopCalendar(getAccessToken());
      setWeeklyOffDays(calendar.weeklyOffDays);
      setHolidays(calendar.holidays);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function toggleDay(day: number) {
    setWeeklyOffDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    );
  }

  function addHoliday() {
    setError(null);
    const date = newHolidayDate.trim();
    const name = newHolidayName.trim();

    if (date === "") {
      setError("Pick a date for the holiday.");
      return;
    }
    if (name === "") {
      setError("Name the holiday, so staff know why the shop is shut.");
      return;
    }
    const clash = holidays.find((h) => h.date === date);
    if (clash) {
      setError(`That date is already on the list as ${clash.name || "a holiday"}.`);
      return;
    }

    setHolidays((current) => [...current, { date, name }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewHolidayDate("");
    setNewHolidayName("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (weeklyOffDays.length === 7) {
      setError("Leave at least one day open — a shop closed all week has no date to collect on.");
      return;
    }

    setIsSaving(true);
    try {
      // upcomingHolidays, not holidays: saving is what clears out the dates that have passed, so
      // the setting holds what the screen shows rather than that plus a growing tail of last
      // year's festivals.
      await saveShopCalendar({ weeklyOffDays, holidays: upcomingHolidays }, getAccessToken());
      setHolidays(upcomingHolidays);
      showToast("Working days saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save these settings.");
    } finally {
      setIsSaving(false);
    }
  }

  // A holiday that has been and gone can no longer change anything: the only thing that reads this
  // list is nextOpenDay, walking forward from a collection date that is always in the future. So a
  // past date is not hidden data, it is spent data — it is dropped from the list here and written
  // out of the setting on the next save, rather than kept in a row nobody can see or remove.
  const today = toIsoDate(new Date());
  const upcomingHolidays = holidays.filter((holiday) => holiday.date >= today);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Working Days</h1>

      <form onSubmit={handleSave} className="flex max-w-xl flex-col gap-6 rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Weekly off</h2>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const isOff = weeklyOffDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  disabled={isLoading}
                  aria-pressed={isOff}
                  // The pill reads SUN; a screen reader still says Sunday.
                  aria-label={day.label}
                  className={`min-h-11 rounded-full border px-4 text-sm font-medium tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    isOff
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface hover:bg-surface-hover"
                  }`}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Holidays</h2>
            <p className="text-sm text-foreground/70">
              One-off closures — festivals, stock-taking. Collection dates skip these too.
            </p>
          </div>

          {/* Date and name side by side on a laptop, stacked on a phone — and the name field takes
              the slack, since "Independence Day" needs more room than a date ever does. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="holidayDate" className="text-sm font-medium">
                Date
              </label>
              <DateInput
                id="holidayDate"
                value={newHolidayDate}
                min={today}
                disabled={isLoading}
                onChange={setNewHolidayDate}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="holidayName" className="text-sm font-medium">
                Holiday name
              </label>
              <input
                id="holidayName"
                value={newHolidayName}
                maxLength={HOLIDAY_NAME_MAX_LENGTH}
                disabled={isLoading}
                placeholder="e.g. Diwali, Pongal"
                onChange={(e) => setNewHolidayName(e.target.value)}
                // Enter adds the holiday instead of submitting the whole form, which would save
                // before the row the operator is clearly still typing had been added.
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addHoliday();
                  }
                }}
                className={holidayFieldClassName}
              />
            </div>
            <Button type="button" variant="secondary" onClick={addHoliday} disabled={isLoading}>
              Add
            </Button>
          </div>

          {upcomingHolidays.length === 0 ? (
            <p className="text-sm text-foreground/70">No holidays added.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {upcomingHolidays.map((holiday) => (
                <li
                  key={holiday.date}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 flex-col">
                    {/* Name first: staff look for "Pongal", then check when it falls. */}
                    <span className="truncate font-medium">{holiday.name || "Holiday"}</span>
                    <span className="text-foreground/70">{formatHoliday(holiday.date)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setHolidays((current) => current.filter((h) => h.date !== holiday.date))}
                    className="shrink-0 text-danger hover:text-danger-hover"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading || isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
