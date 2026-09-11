"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import {
  getTailoringRates,
  saveTailoringRates,
  type TailoringRates,
} from "@/lib/api/tailoring-rates";
import { getGarments, type Garment } from "@/lib/api/garments";

/**
 * The most a garment may be priced at: four digits, so 9,999 and no more.
 *
 * A stitching charge is tens or hundreds of rupees. The field took any number at all, which made a
 * stuck key a mistake that nothing noticed until an order was priced from it.
 */
export const MAX_TAILORING_RATE_DIGITS = 4;
const MAX_TAILORING_RATE = 10 ** MAX_TAILORING_RATE_DIGITS - 1;

/**
 * Digits and at most two decimal places — a price, as it is being typed.
 *
 * The whole part is capped as it is typed rather than complained about on save: there is nothing
 * useful the sixth digit could mean, and refusing the keystroke says so at the moment it happens.
 */
function toAmountText(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  const capped = whole.slice(0, MAX_TAILORING_RATE_DIGITS);
  return rest.length === 0 ? capped : `${capped}.${rest.join("").slice(0, 2)}`;
}

/**
 * The price a field holds, or undefined for "no price set".
 *
 * Zero is not a price a shop charges, so a field showing 0 means the garment has not been priced —
 * that is what lets the column read as numbers throughout instead of alternating with "Not set".
 */
function priceOf(text: string): number | undefined {
  const amount = Number(text.trim());
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

/** How an amount is shown: a real price as itself, an unpriced garment as 0. */
function toFieldText(amount: number | undefined): string {
  return amount === undefined ? "0" : String(amount);
}

/**
 * What the shop charges to stitch each garment — read by New Order to fill a row's Tailoring
 * amount in the moment a garment is picked.
 */
export default function TailoringCostSettingsPage() {
  const { showToast } = useToast();
  // Held as strings: an amount being typed passes through "" and "12." on its way to a number, and
  // neither is a number worth storing yet.
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  // What the server holds, so the screen can show what has moved and save only that.
  const [saved, setSaved] = useState<TailoringRates>({});
  // The rows come from the garment master, so removing a garment there takes its price row with it.
  const [garments, setGarments] = useState<Garment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableSectionElement>(null);

  const toText = useCallback(
    (rates: TailoringRates, list: Garment[]) =>
      Object.fromEntries(list.map((g) => [g.name, toFieldText(rates[g.name])])),
    [],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rates, list] = await Promise.all([getTailoringRates(getAccessToken()), getGarments(getAccessToken())]);
      setSaved(rates);
      setGarments(list);
      setAmounts(toText(rates, list));
    } finally {
      setIsLoading(false);
    }
  }, [toText]);

  useEffect(() => {
    // See CustomersPage for why this fetch-on-dependency-change pattern is intentionally not
    // restructured around the set-state-in-effect lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const changedGarments = garments
    .map((g) => g.name)
    .filter((garment) => priceOf(amounts[garment] ?? "") !== saved[garment]);
  const isDirty = changedGarments.length > 0;

  /** Enter walks down the column — a price list is filled top to bottom, not by reaching for the mouse. */
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const inputs = tableRef.current?.querySelectorAll("input");
    inputs?.[index + 1]?.focus();
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const next: TailoringRates = {};
    for (const garment of garments) {
      const price = priceOf(amounts[garment.name] ?? "");
      if (price === undefined) {
        continue;
      }
      // Backstop to the typing cap above, which the decimal places can still slip past — "99999.99"
      // is five whole digits and over the limit.
      if (price > MAX_TAILORING_RATE) {
        setError(`${garment.name}: a price can be at most ${MAX_TAILORING_RATE.toLocaleString()}.`);
        return;
      }
      next[garment.name] = price;
    }

    setIsSaving(true);
    try {
      await saveTailoringRates(next, saved, getAccessToken());
      setSaved(next);
      setAmounts(toText(next, garments));
      showToast(changedGarments.length === 1 ? "1 price updated." : `${changedGarments.length} prices updated.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save these settings.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Tailoring Cost</h1>

      <form onSubmit={handleSave} className="flex max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {/* Painted on the cells, not the row: with border-collapse a background set on
                  thead or tr does not reliably fill the cell boxes. */}
              <th className="border border-border bg-surface-hover px-3 py-2 text-left font-medium">Garment</th>
              {/* A price is four digits at most, so the column is sized to that and the garment name
                  takes the rest — a full-width amount field reads as if it expects more than it does. */}
              <th className="w-28 border border-border bg-surface-hover px-3 py-2 text-center font-medium">Price</th>
            </tr>
          </thead>
          <tbody ref={tableRef}>
            {garments.map(({ name: garment }, index) => {
              const value = amounts[garment] ?? "";
              const isChanged = changedGarments.includes(garment);

              return (
                <tr key={garment}>
                  <td className="border border-border px-3 py-1">
                    <label htmlFor={`rate-${garment}`} className="flex items-center gap-2">
                      {/* An edit is marked in the row itself, so what is about to be saved is
                          visible before saving it — and matches what the Activity Log will record. */}
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${isChanged ? "bg-primary" : "bg-transparent"}`}
                      />
                      <span>{garment}</span>
                      {isChanged && <span className="sr-only">changed, not saved yet</span>}
                    </label>
                  </td>
                  <td className="border border-border px-2 py-1">
                    <div className="relative">
                      {/* The rupee sits inside the field rather than in the header, so a row reads
                          as an amount on its own — and it is not part of the value, so nothing has
                          to strip it back off on save. */}
                      <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-foreground/60">
                        ₹
                      </span>
                      <input
                        id={`rate-${garment}`}
                        // Text, not number: a number field carries stepper arrows that nudge a
                        // price one rupee at a time, which is not how a price is set. inputMode
                        // still opens the numeric keypad on a phone.
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={value}
                        disabled={isLoading}
                        onChange={(e) =>
                          setAmounts((current) => ({ ...current, [garment]: toAmountText(e.target.value) }))
                        }
                        // Emptying the field is how a price is removed; it settles back to 0 on the
                        // way out so the column never shows a blank cell.
                        onBlur={() =>
                          setAmounts((current) =>
                            (current[garment] ?? "").trim() === "" ? { ...current, [garment]: "0" } : current,
                          )
                        }
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        // 16px so iOS does not zoom the page in when a field takes focus.
                        className={`min-h-11 w-full rounded-md border bg-surface px-5 text-center text-base tabular-nums outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50 ${
                          isChanged ? "border-primary" : "border-border"
                        }`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          {/* Says what Save is about to do, so nobody has to remember which rows they touched. */}
          <span className="mr-auto text-sm text-foreground/70">
            {isDirty ? `${changedGarments.length} unsaved ${changedGarments.length === 1 ? "change" : "changes"}` : ""}
          </span>
          {/* Disabled until something has actually moved — pressing Save on an untouched list
              would write nothing, and a button that does nothing invites pressing it again. */}
          <Button type="submit" disabled={isLoading || isSaving || !isDirty}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
