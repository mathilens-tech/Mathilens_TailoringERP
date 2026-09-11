"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import {
  getBusinessMode,
  saveBusinessMode,
  BUSINESS_MODES,
  DEFAULT_BUSINESS_MODE,
  type BusinessMode,
} from "@/lib/api/business-mode";

/**
 * Which trade the shop is in — the choice that decides whether a new order asks about fabric.
 *
 * This used to be a pair of pills in the New Order screen's title row, set per order. It was the
 * same answer every time for any given shop, and getting it wrong on one order priced that order
 * differently from the rest, so it belongs to the shop.
 */
export default function BusinessModeSettingsPage() {
  const { showToast } = useToast();
  const [mode, setMode] = useState<BusinessMode>(DEFAULT_BUSINESS_MODE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    // Never rejects — an unconfigured shop falls back to tailoring-only.
    const saved = await getBusinessMode(getAccessToken());
    setMode(saved);
    setIsLoading(false);
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
    setIsSaving(true);
    try {
      await saveBusinessMode(mode, getAccessToken());
      showToast("Business mode saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save this setting.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Business Mode</h1>

      <form onSubmit={handleSave} className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Business mode</legend>
          {BUSINESS_MODES.map((choice) => (
            <label
              key={choice.value}
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                mode === choice.value ? "border-primary ring-1 ring-primary/40" : "border-border hover:border-foreground/40"
              }`}
            >
              <input
                type="radio"
                name="businessMode"
                value={choice.value}
                checked={mode === choice.value}
                disabled={isLoading}
                onChange={() => setMode(choice.value)}
                className="shrink-0 accent-[var(--primary)]"
              />
              <span className="text-sm font-medium">{choice.label}</span>
            </label>
          ))}
        </fieldset>

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
