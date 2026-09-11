"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { getSetting, upsertSetting, DEFAULT_ORDER_DUE_DATE_DAYS_KEY } from "@/lib/api/settings";

/**
 * The longest turnaround a shop can commit to here: two digits, so 99 days and no more. A tailoring
 * order measured in months is not a turnaround, it is a typo — and the pre-filled collection date is
 * what a customer is told.
 */
const MAX_ORDER_DURATION_DIGITS = 2;
const MAX_ORDER_DURATION_DAYS = 10 ** MAX_ORDER_DURATION_DIGITS - 1;

/**
 * What a keystroke may leave in the field: digits only, and never a third one.
 *
 * Capped as it is typed rather than complained about on save — the third digit cannot mean anything
 * here, so refusing it at the moment it happens says so more plainly than an error would.
 */
function toDaysText(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, MAX_ORDER_DURATION_DIGITS);
}

/** How far ahead a new order's due date is pre-filled. */
export default function OrderDurationSettingsPage() {
  const { showToast } = useToast();
  const [days, setDays] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const setting = await getSetting(DEFAULT_ORDER_DUE_DATE_DAYS_KEY, getAccessToken());
      setDays(setting.value);
    } catch {
      // Not configured yet — leave the field blank, same as a fresh install.
      setDays("");
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

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const value = Number(days);
    if (!Number.isInteger(value) || value <= 0) {
      setError("Enter a whole number of days greater than zero.");
      return;
    }
    if (value > MAX_ORDER_DURATION_DAYS) {
      setError(`Order duration can be at most ${MAX_ORDER_DURATION_DAYS} days.`);
      return;
    }

    setIsSaving(true);
    try {
      await upsertSetting(DEFAULT_ORDER_DUE_DATE_DAYS_KEY, String(value), getAccessToken());
      showToast("Order duration saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save this setting.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Order Duration</h1>

      <form onSubmit={handleSave} className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <Input
          id="orderDurationDays"
          label="Number of days"
          type="number"
          min="1"
          max={MAX_ORDER_DURATION_DAYS}
          step="1"
          value={days}
          onChange={(e) => setDays(toDaysText(e.target.value))}
          disabled={isLoading}
          placeholder="e.g. 5"
        />
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
